import express from 'express';
import { auth } from '../middleware/auth.js';
import db from '../db/connection.js';

const router = express.Router();
router.use(auth);

// Create sale with FEFO deduction — the core billing logic
router.post('/', (req, res) => {
  const { customer_id, customer_name, customer_phone, items } = req.body;
  if (!items || !items.length) return res.status(400).json({ error: 'Items required' });

  const insertSaleItem = db.prepare(
    'INSERT INTO sale_items (sale_id, medicine_id, batch_id, quantity, price_at_sale) VALUES (?, ?, ?, ?, ?)'
  );
  const updateBatch = db.prepare('UPDATE batches SET qty = qty - ? WHERE id = ?');
  const insertAlert = db.prepare(
    'INSERT INTO alerts (medicine_id, type, message) VALUES (?, ?, ?)'
  );

  const saleItems = []; // collected for response

  try {
    const sale = db.transaction(() => {
      // Validate stock availability for all items first
      for (const item of items) {
        const row = db.prepare(
          'SELECT COALESCE(SUM(b.qty), 0) as total FROM batches b WHERE b.medicine_id = ?'
        ).get(item.medicine_id);
        if (row.total < item.quantity) {
          const med = db.prepare('SELECT name FROM medicines WHERE id = ?').get(item.medicine_id);
          throw new Error(`Insufficient stock for ${med?.name || item.medicine_id}: need ${item.quantity}, have ${row.total}`);
        }
      }

      // Create or find customer
      let custId = customer_id || null;
      if (customer_name && !custId) {
        const existing = db.prepare('SELECT id FROM customers WHERE phone = ?').get(customer_phone);
        if (existing) {
          custId = existing.id;
        } else if (customer_phone) {
          const r = db.prepare('INSERT INTO customers (name, phone) VALUES (?, ?)').run(customer_name, customer_phone);
          custId = r.lastInsertRowid;
        }
      }

      // Generate invoice number
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const count = db.prepare("SELECT COUNT(*) as c FROM sales WHERE DATE(created_at) = DATE('now')").get();
      const invoiceNo = `INV-${today}-${String(count.c + 1).padStart(3, '0')}`;

      let subtotal = 0;
      let totalGst = 0;
      const allSaleItems = [];

      // FEFO deduction for each cart item
      for (const item of items) {
        const med = db.prepare('SELECT * FROM medicines WHERE id = ?').get(item.medicine_id);
        const batches = db.prepare(
          'SELECT * FROM batches WHERE medicine_id = ? AND qty > 0 ORDER BY expiry_date ASC'
        ).all(item.medicine_id);

        let remaining = item.quantity;
        for (const batch of batches) {
          if (remaining <= 0) break;
          const draw = Math.min(remaining, batch.qty);
          const lineTotal = draw * med.price;
          const lineGst = lineTotal * (med.gst_rate / 100);

          updateBatch.run(draw, batch.id);
          // sale_id will be filled after sale insert, use temp array
          allSaleItems.push({
            medicine_id: item.medicine_id, batch_id: batch.id,
            quantity: draw, price_at_sale: med.price,
            name: med.name, brand: med.brand, gst_rate: med.gst_rate,
            lineTotal: Math.round((lineTotal + lineGst) * 100) / 100
          });

          subtotal += lineTotal;
          totalGst += lineGst;
          remaining -= draw;
        }
        if (remaining > 0) throw new Error('Stock deduction failed — concurrent conflict. Please retry.');

        // Check low stock after deduction
        const stockNow = db.prepare(
          'SELECT COALESCE(SUM(qty), 0) as total FROM batches WHERE medicine_id = ?'
        ).get(item.medicine_id);
        if (stockNow.total <= med.low_stock_threshold && stockNow.total > 0) {
          insertAlert.run(item.medicine_id, 'low_stock',
            `Low stock: ${med.name} — ${stockNow.total} units remaining (threshold: ${med.low_stock_threshold})`
          );
        } else if (stockNow.total === 0) {
          insertAlert.run(item.medicine_id, 'low_stock', `Out of stock: ${med.name}`);
        }
      }

      const totalAmount = Math.round((subtotal + totalGst) * 100) / 100;
      const saleResult = db.prepare(
        'INSERT INTO sales (invoice_no, customer_id, subtotal, gst_amount, total_amount, billed_by) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(invoiceNo, custId, Math.round(subtotal * 100) / 100, Math.round(totalGst * 100) / 100, totalAmount, req.user.id);

      const saleId = saleResult.lastInsertRowid;

      for (const si of allSaleItems) {
        insertSaleItem.run(saleId, si.medicine_id, si.batch_id, si.quantity, si.price_at_sale);
      }

      return { saleId, invoiceNo, subtotal, totalGst, totalAmount, items: allSaleItems };
    })();

    res.status(201).json(sale);

  } catch (err) {
    if (err.message.includes('Insufficient') || err.message.includes('concurrent')) {
      return res.status(400).json({ error: err.message });
    }
    console.error('Sale error:', err);
    res.status(500).json({ error: 'Sale failed' });
  }
});

// List sales
router.get('/', (req, res) => {
  const sales = db.prepare(`
    SELECT s.*, c.name as customer_name, c.phone as customer_phone,
      u.name as billed_by_name
    FROM sales s
    LEFT JOIN customers c ON c.id = s.customer_id
    LEFT JOIN users u ON u.id = s.billed_by
    ORDER BY s.created_at DESC
  `).all();
  res.json(sales);
});

// Get single sale with items
router.get('/:id', (req, res) => {
  const sale = db.prepare(`
    SELECT s.*, c.name as customer_name, c.phone as customer_phone,
      u.name as billed_by_name
    FROM sales s
    LEFT JOIN customers c ON c.id = s.customer_id
    LEFT JOIN users u ON u.id = s.billed_by
    WHERE s.id = ?
  `).get(req.params.id);
  if (!sale) return res.status(404).json({ error: 'Sale not found' });

  const items = db.prepare(`
    SELECT si.*, m.name as medicine_name, m.brand, m.gst_rate,
      b.batch_no, b.expiry_date
    FROM sale_items si
    JOIN medicines m ON m.id = si.medicine_id
    JOIN batches b ON b.id = si.batch_id
    WHERE si.sale_id = ?
  `).all(req.params.id);

  res.json({ ...sale, items });
});

// Dead stock: medicines with no sales in 90+ days
router.get('/analytics/dead-stock', (req, res) => {
  const dead = db.prepare(`
    SELECT m.id, m.name, m.brand, m.category,
      COALESCE(SUM(b.qty), 0) as total_stock,
      MAX(s.created_at) as last_sold
    FROM medicines m
    LEFT JOIN batches b ON b.medicine_id = m.id
    LEFT JOIN sale_items si ON si.medicine_id = m.id
    LEFT JOIN sales s ON s.id = si.sale_id
    GROUP BY m.id
    HAVING total_stock > 0 AND (last_sold IS NULL OR last_sold < DATE('now', '-90 days'))
    ORDER BY total_stock DESC
  `).all();
  res.json(dead);
});

// Analytics: daily sales
router.get('/analytics/daily', (req, res) => {
  const days = parseInt(req.query.days) || 7;
  const data = db.prepare(`
    SELECT DATE(s.created_at) as date,
      COUNT(DISTINCT s.id) as invoices,
      SUM(s.total_amount) as revenue,
      SUM(si.quantity) as units_sold
    FROM sales s
    JOIN sale_items si ON si.sale_id = s.id
    WHERE s.created_at >= DATE('now', '-' || ? || ' days')
    GROUP BY DATE(s.created_at)
    ORDER BY date ASC
  `).all(days);
  res.json(data);
});

// Analytics: weekly sales
router.get('/analytics/weekly', (req, res) => {
  const data = db.prepare(`
    SELECT strftime('%Y-W%W', s.created_at) as week,
      COUNT(DISTINCT s.id) as invoices,
      SUM(s.total_amount) as revenue,
      SUM(si.quantity) as units_sold
    FROM sales s
    JOIN sale_items si ON si.sale_id = s.id
    WHERE s.created_at >= DATE('now', '-56 days')
    GROUP BY week
    ORDER BY week ASC
  `).all();
  res.json(data);
});

export default router;
