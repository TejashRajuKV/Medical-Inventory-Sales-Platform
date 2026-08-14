import express from 'express';
import { auth } from '../middleware/auth.js';
import db from '../db/connection.js';

const router = express.Router();
router.use(auth);

router.get('/', (req, res) => {
  const adjustments = db.prepare(`
    SELECT sa.*, b.batch_no, m.name as medicine_name, u.name as adjusted_by_name
    FROM stock_adjustments sa
    JOIN batches b ON b.id = sa.batch_id
    JOIN medicines m ON m.id = b.medicine_id
    LEFT JOIN users u ON u.id = sa.adjusted_by
    ORDER BY sa.created_at DESC
  `).all();
  res.json(adjustments);
});

router.post('/', (req, res) => {
  const { batch_id, qty_change, reason } = req.body;
  if (!batch_id || qty_change == null || !reason) {
    return res.status(400).json({ error: 'batch_id, qty_change, and reason required' });
  }

  try {
    db.transaction(() => {
      const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batch_id);
      if (!batch) throw new Error('Batch not found');
      if (batch.qty + qty_change < 0) throw new Error('Adjustment would make stock negative');

      db.prepare('UPDATE batches SET qty = qty + ? WHERE id = ?').run(qty_change, batch_id);
      db.prepare(
        'INSERT INTO stock_adjustments (batch_id, qty_change, reason, adjusted_by) VALUES (?, ?, ?, ?)'
      ).run(batch_id, qty_change, reason, req.user.id);
    })();
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
