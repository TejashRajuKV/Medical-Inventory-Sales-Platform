import express from 'express';
import bcrypt from 'bcryptjs';
import { auth, ownerOnly } from '../middleware/auth.js';
import db from '../db/connection.js';
import { auditLog } from '../utils/audit.js';

const router = express.Router();
router.use(auth, ownerOnly);

router.get('/', (req, res) => {
  const users = db.prepare('SELECT id, name, email, role, created_at FROM users ORDER BY id').all();
  res.json(users);
});

router.post('/', (req, res) => {
  const { name, email, password, role = 'staff' } = req.body;
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 150 || typeof email !== 'string' || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) || typeof password !== 'string' || password.length < 10 || !['owner', 'staff', 'manager'].includes(role)) {
    return res.status(400).json({ error: 'Valid name/email, password of at least 10 characters, and an allowed role are required' });
  }
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(409).json({ error: 'Email already exists' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)').run(name.trim(), email.trim().toLowerCase(), hash, role);
  auditLog(req.user.id, 'user.created', 'user', result.lastInsertRowid, { email: email.trim().toLowerCase(), role });
  res.status(201).json({ id: result.lastInsertRowid, name: name.trim(), email: email.trim().toLowerCase(), role });
});

router.delete('/:id', (req, res) => {
  if (req.user.id === Number(req.params.id)) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  const targetId = Number(req.params.id);
  if (!Number.isSafeInteger(targetId) || targetId <= 0) return res.status(400).json({ error: 'Invalid user ID' });
  const target = db.prepare('SELECT id, role FROM users WHERE id = ?').get(targetId);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.role === 'owner' && db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'owner'").get().count <= 1) return res.status(409).json({ error: 'Cannot delete the last owner account' });
  db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
  auditLog(req.user.id, 'user.deleted', 'user', targetId, { role: target.role });
  res.json({ success: true });
});

export default router;
