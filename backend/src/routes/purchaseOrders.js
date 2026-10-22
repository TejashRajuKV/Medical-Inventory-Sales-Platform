import express from 'express';
import { auth } from '../middleware/auth.js';
import db from '../db/connection.js';
import { auditLog } from '../utils/audit.js';

const router = express.Router();
router.use(auth);

// List purchase orders
router.get('/', (req, res) => {
  const status = req.query.status;
  let query = `
    SELECT po.*, s.name as supplier_name,
      (SELECT COUNT(*) FROM batches b WHERE b.purchase_order_id = po.id) as batch_count
    FROM purchase_orders po
    LEFT JOIN suppliers s ON s.id = po.supplier_id
  `;
  const params = [];
  if (status) {
    if (!['ordered', 'received', 'cancelled'].includes(status)) return res.status(400).json({ error: 'Invalid purchase-order status filter' });
    query += ' WHERE po.status = ?'; params.push(status);
  }
  query += ' ORDER BY po.ordered_at DESC';
  res.json(db.prepare(query).all(...params));
});

// Place a purchase order
router.post('/', (req, res) => {
  const { supplier_id } = req.body;
  if (!Number.isSafeInteger(Number(supplier_id)) || Number(supplier_id) <= 0) return res.status(400).json({ error: 'Valid supplier_id required' });
  if (!db.prepare('SELECT id FROM suppliers WHERE id = ?').get(Number(supplier_id))) return res.status(404).json({ error: 'Supplier not found' });
  const r = db.prepare('INSERT INTO purchase_orders (supplier_id) VALUES (?)').run(Number(supplier_id));
  auditLog(req.user.id, 'purchase_order.created', 'purchase_order', r.lastInsertRowid, { supplier_id: Number(supplier_id) });
  res.status(201).json({ id: r.lastInsertRowid });
});

// Receive a purchase order — create batches from it
router.post('/:id/receive', (req, res) => {
  const { batches: batchItems } = req.body; // [{ medicine_id, batch_no, expiry_date, qty, cost_price }]
  if (!Array.isArray(batchItems) || batchItems.length === 0 || batchItems.length > 200) return res.status(400).json({ error: 'Provide between 1 and 200 batch items' });
  if (batchItems.some((b) => !b || !Number.isSafeInteger(Number(b.medicine_id)) || Number(b.medicine_id) <= 0 || typeof b.batch_no !== 'string' || !b.batch_no.trim() || b.batch_no.trim().length > 100 || typeof b.expiry_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b.expiry_date) || Number.isSafeInteger(b.qty) === false || b.qty <= 0 || !Number.isFinite(Number(b.cost_price)) || Number(b.cost_price) < 0)) return res.status(400).json({ error: 'Each batch needs a valid medicine, batch number, YYYY-MM-DD expiry, positive integer quantity and non-negative cost price' });

  try {
    const result = db.transaction(() => {
      const po = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(req.params.id);
      if (!po) throw new Error('Purchase order not found');
      if (po.status !== 'ordered') throw new Error('Only ordered purchase orders can be received');

      const insertBatch = db.prepare(
        'INSERT INTO batches (medicine_id, purchase_order_id, batch_no, expiry_date, qty, cost_price) VALUES (?, ?, ?, ?, ?, ?)'
      );

      for (const b of batchItems) {
        const medicine = db.prepare('SELECT id, supplier_id FROM medicines WHERE id = ?').get(Number(b.medicine_id));
        if (!medicine) throw new Error('Medicine not found: ' + b.medicine_id);
        if (medicine.supplier_id && Number(medicine.supplier_id) !== Number(po.supplier_id)) throw new Error('Medicine supplier does not match purchase-order supplier');
        const date = new Date(b.expiry_date + 'T00:00:00Z');
        if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== b.expiry_date) throw new Error('Invalid expiry date');
        if (b.expiry_date < new Date().toISOString().slice(0, 10)) throw new Error('Expired stock cannot be received into sellable inventory');
        insertBatch.run(Number(b.medicine_id), req.params.id, b.batch_no.trim(), b.expiry_date, b.qty, Number(b.cost_price));
      }

      db.prepare("UPDATE purchase_orders SET status = 'received', received_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(req.params.id);

      auditLog(req.user.id, 'purchase_order.received', 'purchase_order', po.id, { batch_count: batchItems.length });
      return batchItems.length;
    })();

    res.json({ success: true, batches_created: result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
