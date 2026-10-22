import jwt from 'jsonwebtoken';
import db from '../db/connection.js';

export function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'No token provided' });
  if (!process.env.JWT_SECRET) return res.status(503).json({ error: 'Authentication is not configured' });
  try {
    const payload = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(payload.id);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: 'Insufficient permissions' });
    next();
  };
}

export function ownerOnly(req, res, next) {
  return requireRole('owner')(req, res, next);
}