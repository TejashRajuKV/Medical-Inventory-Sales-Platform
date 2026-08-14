import express from 'express';
import bcrypt from 'bcryptjs';
import { auth, ownerOnly } from '../middleware/auth.js';
import db from '../db/connection.js';

const router = express.Router();
router.use(auth, ownerOnly);

router.get('/', (req, res) => {
  const users = db.prepare('SELECT id, name, email, role, created_at FROM users ORDER BY id').all();
  res.json(users);
});

router.post('/', (req, res) => {
  const { name, email, password, role = 'staff' } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password required' });
  }
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(409).json({ error: 'Email already exists' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)').run(name, email, hash, role);
  res.status(201).json({ id: result.lastInsertRowid, name, email, role });
});

router.delete('/:id', (req, res) => {
  if (req.user.id === Number(req.params.id)) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
