import express from 'express';
import { auth, requireRole } from '../middleware/auth.js';
import db from '../db/connection.js';
import { auditLog } from '../utils/audit.js';

const router = express.Router();
router.use(auth);
const validMoney = (value) => Number.isFinite(Number(value)) && Number(value) >= 0;
const validMedicineInput = (body) => body.price != null && body.price !== '' && typeof body.name === 'string' && body.name.trim().length > 0 && body.name.trim().length <= 200 && validMoney(body.price) && (body.cost_price == null || body.cost_price === '' || validMoney(body.cost_price)) && (body.gst_rate == null || validMoney(body.gst_rate) && Number(body.gst_rate) <= 100) && (body.low_stock_threshold == null || Number.isSafeInteger(Number(body.low_stock_threshold)) && Number(body.low_stock_threshold) >= 0);

// List medicines with computed stock from batches
router.get('/', (req, res) => {
  const search = req.query.search;
  let query = `
    SELECT m.*,
      COALESCE(SUM(CASE WHEN date(b.expiry_date) >= date('now') THEN b.qty ELSE 0 END), 0) AS total_stock,
      COALESCE(SUM(CASE WHEN date(b.expiry_date) < date('now') THEN b.qty ELSE 0 END), 0) AS expired_stock,
      MIN(CASE WHEN date(b.expiry_date) >= date('now') AND b.qty > 0 THEN b.expiry_date END) AS nearest_expiry
    FROM medicines m
    LEFT JOIN batches b ON b.medicine_id = m.id
  `;
  const params = [];
  if (search) {
    query += ' WHERE m.name LIKE ? OR m.brand LIKE ? OR m.salt_composition LIKE ?';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  query += ' GROUP BY m.id ORDER BY m.name';
  const medicines = db.prepare(query).all(...params);
  res.json(medicines);
});

// Get single medicine with its batches
router.get('/:id(\\d+)', (req, res) => {
  const medicineId = Number(req.params.id);
  const medicine = db.prepare('SELECT * FROM medicines WHERE id = ?').get(medicineId);
  if (!medicine) return res.status(404).json({ error: 'Medicine not found' });

  const batches = db.prepare(
    "SELECT *, CASE WHEN date(expiry_date) < date('now') THEN 1 ELSE 0 END AS is_expired FROM batches WHERE medicine_id = ? ORDER BY date(expiry_date) ASC, id ASC"
  ).all(medicineId);

  const totalStock = batches.reduce((sum, batch) => sum + (batch.is_expired ? 0 : batch.qty), 0);
  const expiredStock = batches.reduce((sum, batch) => sum + (batch.is_expired ? batch.qty : 0), 0);

  res.json({ ...medicine, batches, totalStock, expiredStock });
});

// Create medicine
router.post('/', requireRole('owner', 'manager'), (req, res) => {
  const { name, brand, salt_composition, category, is_prescription_required, cost_price, price, gst_rate, low_stock_threshold, barcode, supplier_id } = req.body;
  if (!validMedicineInput(req.body)) return res.status(400).json({ error: 'Provide a medicine name, non-negative price/cost, GST between 0 and 100, and a non-negative whole-number stock threshold' });
  if (supplier_id != null && supplier_id !== '' && (!Number.isSafeInteger(Number(supplier_id)) || Number(supplier_id) <= 0 || !db.prepare('SELECT id FROM suppliers WHERE id = ?').get(Number(supplier_id)))) return res.status(400).json({ error: 'Supplier does not exist' });

  const result = db.prepare(`
    INSERT INTO medicines (name, brand, salt_composition, category, is_prescription_required, cost_price, price, gst_rate, low_stock_threshold, barcode, supplier_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name.trim(), brand || null, salt_composition || null, category || null, is_prescription_required ? 1 : 0, cost_price === '' || cost_price == null ? null : Number(cost_price), Number(price), gst_rate == null || gst_rate === '' ? 0 : Number(gst_rate), low_stock_threshold == null || low_stock_threshold === '' ? 10 : Number(low_stock_threshold), barcode || null, supplier_id || null);

  auditLog(req.user.id, 'medicine.created', 'medicine', result.lastInsertRowid, { name: name.trim() });
  res.status(201).json({ id: result.lastInsertRowid, name: name.trim(), price: Number(price) });
});

// Update medicine
router.put('/:id', requireRole('owner', 'manager'), (req, res) => {
  const { name, brand, salt_composition, category, is_prescription_required, cost_price, price, gst_rate, low_stock_threshold, barcode, supplier_id } = req.body;
  if (!validMedicineInput(req.body)) return res.status(400).json({ error: 'Invalid medicine fields or price values' });
  if (supplier_id != null && supplier_id !== '' && (!Number.isSafeInteger(Number(supplier_id)) || Number(supplier_id) <= 0 || !db.prepare('SELECT id FROM suppliers WHERE id = ?').get(Number(supplier_id)))) return res.status(400).json({ error: 'Supplier does not exist' });
  const existing = db.prepare('SELECT id FROM medicines WHERE id = ?').get(Number(req.params.id));
  if (!existing) return res.status(404).json({ error: 'Medicine not found' });

  db.prepare(`
    UPDATE medicines SET name=?, brand=?, salt_composition=?, category=?, is_prescription_required=?,
      cost_price=?, price=?, gst_rate=?, low_stock_threshold=?, barcode=?, supplier_id=?
    WHERE id=?
  `).run(name, brand || null, salt_composition || null, category || null, is_prescription_required ? 1 : 0, cost_price === '' || cost_price == null ? null : Number(cost_price), Number(price), gst_rate == null || gst_rate === '' ? 0 : Number(gst_rate), low_stock_threshold == null || low_stock_threshold === '' ? 10 : Number(low_stock_threshold), barcode || null, supplier_id || null, Number(req.params.id));

  auditLog(req.user.id, 'medicine.updated', 'medicine', req.params.id, { name: name.trim() });
  res.json({ success: true });
});

// Delete medicine (only if no sales history)
router.delete('/:id', requireRole('owner', 'manager'), (req, res) => {
  const medicineId = Number(req.params.id);
  if (!Number.isSafeInteger(medicineId) || medicineId <= 0) return res.status(400).json({ error: 'Invalid medicine ID' });
  const exists = db.prepare('SELECT id FROM medicines WHERE id = ?').get(medicineId);
  if (!exists) return res.status(404).json({ error: 'Medicine not found' });
  const history = db.prepare('SELECT (SELECT COUNT(*) FROM sale_items WHERE medicine_id = ?) + (SELECT COUNT(*) FROM batches WHERE medicine_id = ?) AS total').get(medicineId, medicineId).total;
  if (history > 0) return res.status(409).json({ error: 'Cannot delete a medicine with batch or sales history' });
  db.prepare('DELETE FROM medicines WHERE id = ?').run(medicineId);
  auditLog(req.user.id, 'medicine.deleted', 'medicine', medicineId);
  res.json({ success: true });
});

// Get batches for a medicine
router.get('/:id(\\d+)/batches', (req, res) => {
  const medicine = db.prepare('SELECT id FROM medicines WHERE id = ?').get(Number(req.params.id));
  if (!medicine) return res.status(404).json({ error: 'Medicine not found' });

  const batches = db.prepare(
    "SELECT *, CASE WHEN date(expiry_date) < date('now') THEN 1 ELSE 0 END AS is_expired FROM batches WHERE medicine_id = ? ORDER BY date(expiry_date) ASC, id ASC"
  ).all(Number(req.params.id));
  res.json(batches);
});

export default router;
