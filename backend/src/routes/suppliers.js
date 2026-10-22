import express from 'express';
import { auth, ownerOnly, requireRole } from '../middleware/auth.js';
import db from '../db/connection.js';
import { auditLog } from '../utils/audit.js';

const router = express.Router();
router.use(auth);

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM suppliers ORDER BY name').all());
});

router.post('/', requireRole('owner', 'manager'), (req, res) => {
  const { name, contact_info } = req.body;
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 150 || (contact_info != null && (typeof contact_info !== 'string' || contact_info.length > 500))) return res.status(400).json({ error: 'Valid supplier name and contact details are required' });
  const r = db.prepare('INSERT INTO suppliers (name, contact_info) VALUES (?, ?)').run(name.trim(), contact_info?.trim() || null);
  auditLog(req.user.id, 'supplier.created', 'supplier', r.lastInsertRowid, { name: name.trim() });
  res.status(201).json({ id: r.lastInsertRowid, name: name.trim() });
});

router.put('/:id', requireRole('owner', 'manager'), (req, res) => {
  const { name, contact_info } = req.body;
  if (!Number.isSafeInteger(Number(req.params.id)) || Number(req.params.id) <= 0 || typeof name !== 'string' || !name.trim() || name.trim().length > 150 || (contact_info != null && (typeof contact_info !== 'string' || contact_info.length > 500))) return res.status(400).json({ error: 'Valid supplier ID, name and contact details are required' });
  const result = db.prepare('UPDATE suppliers SET name = ?, contact_info = ? WHERE id = ?').run(name.trim(), contact_info?.trim() || null, Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: 'Supplier not found' });
  auditLog(req.user.id, 'supplier.updated', 'supplier', req.params.id, { name: name.trim() });
  res.json({ success: true });
});

router.delete('/:id', ownerOnly, (req, res) => {
  if (!Number.isSafeInteger(Number(req.params.id)) || Number(req.params.id) <= 0) return res.status(400).json({ error: 'Invalid supplier ID' });
  const supplierId = Number(req.params.id);
  if (!db.prepare('SELECT id FROM suppliers WHERE id = ?').get(supplierId)) return res.status(404).json({ error: 'Supplier not found' });
  const used = db.prepare('SELECT (SELECT COUNT(*) FROM medicines WHERE supplier_id = ?) + (SELECT COUNT(*) FROM purchase_orders WHERE supplier_id = ?) AS total').get(supplierId, supplierId).total;
  if (used > 0) return res.status(409).json({ error: 'Supplier is linked to medicines or purchase orders and cannot be deleted without breaking history' });
  db.prepare('DELETE FROM suppliers WHERE id = ?').run(supplierId);
  auditLog(req.user.id, 'supplier.deleted', 'supplier', supplierId);
  res.json({ success: true });
});

export default router;
