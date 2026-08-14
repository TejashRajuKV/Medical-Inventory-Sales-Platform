import express from 'express';
import { auth } from '../middleware/auth.js';
import db from '../db/connection.js';

const router = express.Router();
router.use(auth);

router.get('/', (req, res) => {
  const unreadOnly = req.query.unread === '1';
  const alerts = db.prepare(`
    SELECT a.*, m.name as medicine_name, m.brand
    FROM alerts a
    LEFT JOIN medicines m ON m.id = a.medicine_id
    ORDER BY a.sent_at DESC
    LIMIT 100
  `).all();
  const unread = alerts.filter(a => !a.is_read).length;
  res.json(unreadOnly ? alerts.filter(a => !a.is_read) : { alerts, unread });
});

router.post('/mark-read/:id', (req, res) => {
  db.prepare('UPDATE alerts SET is_read = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.post('/mark-all-read', (req, res) => {
  db.prepare('UPDATE alerts SET is_read = 1').run();
  res.json({ success: true });
});

export default router;
