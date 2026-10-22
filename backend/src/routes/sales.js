import express from 'express';
import { auth } from '../middleware/auth.js';
import db from '../db/connection.js';

const router = express.Router();
router.use(auth);

const isPositiveInteger = (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0;
const roundMoney = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

// Create sale with FEFO deduction. Expired and empty batches are never sellable.
router.post('/', (req, res) => {
  const { customer_id, customer_name, customer_phone, items } = req.body ?? {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one sale item is required' });
  }
  if (items.some((item) =>
    !item ||
    !isPositiveInteger(item.medicine_id) ||
    !isPositiveInteger(item.quantity)
  )) {
    return res.status(400).json({ error: 'Each item must have a valid medicine_id and a positive whole-number quantity' });
  }

  // Consolidate repeated cart rows so stock checks are performed against the real
  // total demand for each medicine, not each duplicate row independently.
  const demandByMedicine = new Map();
  for (const item of items) {
    const medicineId = Number(item.medicine_id);
    const quantity = Number(item.quantity);
    demandByMedicine.set(medicineId, (demandByMedicine.get(medicineId) || 0) + quantity);
  }

  const insertSaleItem = db.prepare(
    'INSERT INTO sale_items (sale_id, medicine_id, batch_id, quantity, price_at_sale) VALUES (?, ?, ?, ?, ?)'
  );
  const updateBatch = db.prepare(
    'UPDATE batches SET qty = qty - ? WHERE id = ? AND qty >= ?'
  );
  const insertAlert = db.prepare(
    'INSERT INTO alerts (medicine_id, type, message) VALUES (?, ?, ?)'
  );

  try {
    const sale = db.transaction(() => {
      // Validate all requested medicines and available non-expired stock before
      // changing inventory. This also rejects unknown medicine IDs.
      for (const [medicineId, quantity] of demandByMedicine) {
        const med = db.prepare('SELECT id, name FROM medicines WHERE id = ?').get(medicineId);
        if (!med) throw new Error(`Medicine not found: ${medicineId}`);

        const row = db.prepare(`
          SELECT COALESCE(SUM(b.qty), 0) AS total
          FROM batches b
          WHERE b.medicine_id = ?
            AND b.qty > 0
            AND date(b.expiry_date) >= date('now')
        `).get(medicineId);

        if (row.total < quantity) {
          throw new Error(`Insufficient unexpired stock for ${med.name}: need ${quantity}, have ${row.total}`);
        }
      }

      // Resolve the customer only after all medicine/stock checks pass.
      let custId = customer_id || null;
      if (custId) {
        const customer = db.prepare('SELECT id FROM customers WHERE id = ?').get(custId);
        if (!customer) throw new Error('Customer not found');
      } else if (customer_name && customer_phone) {
        const existing = db.prepare('SELECT id FROM customers WHERE phone = ?').get(customer_phone);
        if (existing) {
          custId = existing.id;
        } else {
          const created = db.prepare(
            'INSERT INTO customers (name, phone) VALUES (?, ?)'
          ).run(String(customer_name).trim(), String(customer_phone).trim());
          custId = created.lastInsertRowid;
        }
      }

      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const count = db.prepare(
        "SELECT COUNT(*) AS c FROM sales WHERE DATE(created_at) = DATE('now')"
      ).get();
      const invoiceNo = `INV-${today}-${String(count.c + 1).padStart(3, '0')}`;

      let subtotal = 0;
      let totalGst = 0;
      const allSaleItems = [];

      for (const [medicineId, requestedQuantity] of demandByMedicine) {
        const med = db.prepare('SELECT * FROM medicines WHERE id = ?').get(medicineId);
        const batches = db.prepare(`
          SELECT *
          FROM batches
          WHERE medicine_id = ?
            AND qty > 0
            AND date(expiry_date) >= date('now')
          ORDER BY date(expiry_date) ASC, received_at ASC, id ASC
        `).all(medicineId);

        let remaining = requestedQuantity;
        for (const batch of batches) {
          if (remaining <= 0) break;
          const draw = Math.min(remaining, batch.qty);
          const update = updateBatch.run(draw, batch.id, draw);
          if (update.changes !== 1) {
            throw new Error('Stock changed during billing. Please retry the sale.');
          }

          const lineTotal = draw * med.price;
          const lineGst = lineTotal * (med.gst_rate / 100);
          allSaleItems.push({
            medicine_id: medicineId,
            batch_id: batch.id,
            quantity: draw,
            price_at_sale: med.price,
            name: med.name,
            brand: med.brand,
            gst_rate: med.gst_rate,
            lineTotal: roundMoney(lineTotal + lineGst)
          });
          subtotal += lineTotal;
          totalGst += lineGst;
          remaining -= draw;
        }

        if (remaining > 0) {
          throw new Error('Stock changed during billing. Please retry the sale.');
        }

        const stockNow = db.prepare(`
          SELECT COALESCE(SUM(qty), 0) AS total
          FROM batches
          WHERE medicine_id = ? AND date(expiry_date) >= date('now')
        `).get(medicineId);

        if (stockNow.total <= med.low_stock_threshold) {
          insertAlert.run(
            medicineId,
            'low_stock',
            stockNow.total > 0
              ? `Low stock: ${med.name} — ${stockNow.total} unexpired units remaining (threshold: ${med.low_stock_threshold})`
              : `Out of stock: ${med.name}`
          );
        }
      }

      subtotal = roundMoney(subtotal);
      totalGst = roundMoney(totalGst);
      const totalAmount = roundMoney(subtotal + totalGst);
      const saleResult = db.prepare(
        'INSERT INTO sales (invoice_no, customer_id, subtotal, gst_amount, total_amount, billed_by) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(invoiceNo, custId, subtotal, totalGst, totalAmount, req.user.id);

      for (const item of allSaleItems) {
        insertSaleItem.run(
          saleResult.lastInsertRowid,
          item.medicine_id,
          item.batch_id,
          item.quantity,
          item.price_at_sale
        );
      }

      return {
        saleId: saleResult.lastInsertRowid,
        invoiceNo,
        subtotal,
        totalGst,
        totalAmount,
        items: allSaleItems
      };
    })();

    return res.status(201).json(sale);
  } catch (err) {
    if (
      err.message.includes('Insufficient') ||
      err.message.includes('not found') ||
      err.message.includes('Stock changed')
    ) {
      return res.status(400).json({ error: err.message });
    }
    console.error('Sale error:', err);
    return res.status(500).json({ error: 'Sale failed' });
  }
});

// List sales
router.get('/', (req, res) => {
  const sales = db.prepare(`
    SELECT s.*, c.name AS customer_name, c.phone AS customer_phone,
      u.name AS billed_by_name
    FROM sales s
    LEFT JOIN customers c ON c.id = s.customer_id
    LEFT JOIN users u ON u.id = s.billed_by
    ORDER BY s.created_at DESC
  `).all();
  res.json(sales);
});

// Get single sale with items
router.get('/:id(\\d+)', (req, res) => {
  if (!isPositiveInteger(req.params.id)) return res.status(400).json({ error: 'Invalid sale ID' });

  const sale = db.prepare(`
    SELECT s.*, c.name AS customer_name, c.phone AS customer_phone,
      u.name AS billed_by_name
    FROM sales s
    LEFT JOIN customers c ON c.id = s.customer_id
    LEFT JOIN users u ON u.id = s.billed_by
    WHERE s.id = ?
  `).get(Number(req.params.id));
  if (!sale) return res.status(404).json({ error: 'Sale not found' });

  const items = db.prepare(`
    SELECT si.*, m.name AS medicine_name, m.brand, m.gst_rate,
      b.batch_no, b.expiry_date
    FROM sale_items si
    JOIN medicines m ON m.id = si.medicine_id
    JOIN batches b ON b.id = si.batch_id
    WHERE si.sale_id = ?
  `).all(Number(req.params.id));

  res.json({ ...sale, items });
});

// Dead stock: medicines with no sales in 90+ days.
// Aggregate stock separately so multiple sale rows cannot inflate inventory totals.
router.get('/analytics/dead-stock', (req, res) => {
  const dead = db.prepare(`
    WITH stock AS (
      SELECT medicine_id, SUM(qty) AS total_stock
      FROM batches
      GROUP BY medicine_id
    ),
    sales_history AS (
      SELECT medicine_id, MAX(s.created_at) AS last_sold
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      GROUP BY medicine_id
    )
    SELECT m.id, m.name, m.brand, m.category,
      COALESCE(stock.total_stock, 0) AS total_stock,
      sales_history.last_sold
    FROM medicines m
    LEFT JOIN stock ON stock.medicine_id = m.id
    LEFT JOIN sales_history ON sales_history.medicine_id = m.id
    WHERE COALESCE(stock.total_stock, 0) > 0
      AND (sales_history.last_sold IS NULL OR sales_history.last_sold < DATE('now', '-90 days'))
    ORDER BY total_stock DESC
  `).all();
  res.json(dead);
});

// Analytics: daily sales. Aggregate sales and line quantities separately to avoid
// multiplying invoice revenue by the number of items in an invoice.
router.get('/analytics/daily', (req, res) => {
  const requestedDays = Number.parseInt(req.query.days, 10);
  const days = Number.isFinite(requestedDays) ? Math.min(366, Math.max(1, requestedDays)) : 7;
  const data = db.prepare(`
    WITH invoice_totals AS (
      SELECT id, DATE(created_at) AS date, total_amount
      FROM sales
      WHERE created_at >= DATE('now', '-' || ? || ' days')
    ),
    item_totals AS (
      SELECT sale_id, SUM(quantity) AS units_sold
      FROM sale_items
      GROUP BY sale_id
    )
    SELECT i.date,
      COUNT(i.id) AS invoices,
      ROUND(SUM(i.total_amount), 2) AS revenue,
      COALESCE(SUM(it.units_sold), 0) AS units_sold
    FROM invoice_totals i
    LEFT JOIN item_totals it ON it.sale_id = i.id
    GROUP BY i.date
    ORDER BY i.date ASC
  `).all(days);
  res.json(data);
});

// Analytics: weekly sales. Revenue is summed once per invoice, regardless of line count.
router.get('/analytics/weekly', (req, res) => {
  const data = db.prepare(`
    WITH invoice_totals AS (
      SELECT id, strftime('%Y-W%W', created_at) AS week, total_amount
      FROM sales
      WHERE created_at >= DATE('now', '-56 days')
    ),
    item_totals AS (
      SELECT sale_id, SUM(quantity) AS units_sold
      FROM sale_items
      GROUP BY sale_id
    )
    SELECT i.week,
      COUNT(i.id) AS invoices,
      ROUND(SUM(i.total_amount), 2) AS revenue,
      COALESCE(SUM(it.units_sold), 0) AS units_sold
    FROM invoice_totals i
    LEFT JOIN item_totals it ON it.sale_id = i.id
    GROUP BY i.week
    ORDER BY i.week ASC
  `).all();
  res.json(data);
});

export default router;
