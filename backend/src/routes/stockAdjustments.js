import express from 'express';
import { auth, requireRole } from '../middleware/auth.js';
import db from '../db/connection.js';
import { auditLog } from '../utils/audit.js';

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

router.post('/', requireRole('owner', 'manager'), (req, res) => {
  const { batch_id, qty_change, reason } = req.body;
  if (!Number.isSafeInteger(Number(batch_id)) || Number(batch_id) <= 0 || !Number.isSafeInteger(qty_change) || qty_change === 0 || typeof reason !== 'string' || !reason.trim() || reason.trim().length > 500) {
    return res.status(400).json({ error: 'batch_id, qty_change, and reason required' });
  }

  try {
    db.transaction(() => {
      const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(Number(batch_id));
      if (!batch) throw new Error('Batch not found');
      if (batch.qty + qty_change < 0) throw new Error('Adjustment would make stock negative');

      db.prepare('UPDATE batches SET qty = qty + ? WHERE id = ?').run(qty_change, Number(batch_id));
      db.prepare(
        'INSERT INTO stock_adjustments (batch_id, qty_change, reason, adjusted_by) VALUES (?, ?, ?, ?)'
      ).run(Number(batch_id), qty_change, reason.trim(), req.user.id);
      auditLog(req.user.id, 'stock.adjusted', 'batch', batch_id, { qty_change, reason: reason.trim(), previous_qty: batch.qty, new_qty: batch.qty + qty_change });
    })();
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
