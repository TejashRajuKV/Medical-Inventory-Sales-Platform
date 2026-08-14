import express from 'express';
import { auth } from '../middleware/auth.js';
import db from '../db/connection.js';

const router = express.Router();
router.use(auth);

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM suppliers ORDER BY name').all());
});

router.post('/', (req, res) => {
  const { name, contact_info } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const r = db.prepare('INSERT INTO suppliers (name, contact_info) VALUES (?, ?)').run(name, contact_info || null);
  res.status(201).json({ id: r.lastInsertRowid, name });
});

router.put('/:id', (req, res) => {
  const { name, contact_info } = req.body;
  db.prepare('UPDATE suppliers SET name = ?, contact_info = ? WHERE id = ?').run(name, contact_info, req.params.id);
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
