import express from 'express';
import { auth } from '../middleware/auth.js';
import db from '../db/connection.js';

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
  if (status) { query += ' WHERE po.status = ?'; params.push(status); }
  query += ' ORDER BY po.ordered_at DESC';
  res.json(db.prepare(query).all(...params));
});

// Place a purchase order
router.post('/', (req, res) => {
  const { supplier_id } = req.body;
  if (!supplier_id) return res.status(400).json({ error: 'Supplier required' });
  const r = db.prepare('INSERT INTO purchase_orders (supplier_id) VALUES (?)').run(supplier_id);
  res.status(201).json({ id: r.lastInsertRowid });
});

// Receive a purchase order — create batches from it
router.post('/:id/receive', (req, res) => {
  const { batches: batchItems } = req.body; // [{ medicine_id, batch_no, expiry_date, qty, cost_price }]
  if (!batchItems?.length) return res.status(400).json({ error: 'Batch items required' });

  try {
    const result = db.transaction(() => {
      const po = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(req.params.id);
      if (!po) throw new Error('Purchase order not found');
      if (po.status === 'received') throw new Error('Already received');

      const insertBatch = db.prepare(
        'INSERT INTO batches (medicine_id, purchase_order_id, batch_no, expiry_date, qty, cost_price) VALUES (?, ?, ?, ?, ?, ?)'
      );

      for (const b of batchItems) {
        insertBatch.run(b.medicine_id, req.params.id, b.batch_no, b.expiry_date, b.qty, b.cost_price);
      }

      db.prepare("UPDATE purchase_orders SET status = 'received', received_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(req.params.id);

      return batchItems.length;
    })();

    res.json({ success: true, batches_created: result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
