import express from 'express';
import { auth, ownerOnly } from '../middleware/auth.js';
import db from '../db/connection.js';

const router = express.Router();
router.use(auth, ownerOnly);

router.get('/', (req, res) => {
  const parsed = Number.parseInt(req.query.limit, 10);
  const limit = Number.isFinite(parsed) ? Math.min(200, Math.max(1, parsed)) : 50;
  const rows = db.prepare(`
    SELECT a.id, a.user_id, u.name AS user_name, a.action, a.entity_type,
      a.entity_id, a.details, a.created_at
    FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
    ORDER BY a.created_at DESC, a.id DESC LIMIT ?
  `).all(limit);
  res.json(rows);
});

export default router;
