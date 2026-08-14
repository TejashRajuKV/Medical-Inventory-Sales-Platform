import express from 'express';
import { auth } from '../middleware/auth.js';
import db from '../db/connection.js';

const router = express.Router();
router.use(auth);

router.get('/', (req, res) => {
  const search = req.query.search;
  let query = 'SELECT * FROM customers';
  const params = [];
  if (search) {
    query += ' WHERE name LIKE ? OR phone LIKE ?';
    params.push(`%${search}%`, `%${search}%`);
  }
  query += ' ORDER BY created_at DESC LIMIT 50';
  res.json(db.prepare(query).all(...params));
});

router.post('/', (req, res) => {
  const { name, phone } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'Name and phone required' });
  const existing = db.prepare('SELECT id FROM customers WHERE phone = ?').get(phone);
  if (existing) return res.status(409).json({ error: 'Phone already exists', id: existing.id });
  const r = db.prepare('INSERT INTO customers (name, phone) VALUES (?, ?)').run(name, phone);
  res.status(201).json({ id: r.lastInsertRowid, name, phone });
});

export default router;
