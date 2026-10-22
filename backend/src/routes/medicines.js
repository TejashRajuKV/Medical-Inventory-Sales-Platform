import express from 'express';
import { auth } from '../middleware/auth.js';
import db from '../db/connection.js';

const router = express.Router();
router.use(auth);

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
router.post('/', (req, res) => {
  const { name, brand, salt_composition, category, is_prescription_required, cost_price, price, gst_rate, low_stock_threshold, barcode, supplier_id } = req.body;
  if (!name || price == null) {
    return res.status(400).json({ error: 'Name and price are required' });
  }

  const result = db.prepare(`
    INSERT INTO medicines (name, brand, salt_composition, category, is_prescription_required, cost_price, price, gst_rate, low_stock_threshold, barcode, supplier_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, brand || null, salt_composition || null, category || null, is_prescription_required ? 1 : 0, cost_price || null, price, gst_rate || 0, low_stock_threshold || 10, barcode || null, supplier_id || null);

  res.status(201).json({ id: result.lastInsertRowid, name, price });
});

// Update medicine
router.put('/:id', (req, res) => {
  const { name, brand, salt_composition, category, is_prescription_required, cost_price, price, gst_rate, low_stock_threshold, barcode, supplier_id } = req.body;
  const existing = db.prepare('SELECT id FROM medicines WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Medicine not found' });

  db.prepare(`
    UPDATE medicines SET name=?, brand=?, salt_composition=?, category=?, is_prescription_required=?,
      cost_price=?, price=?, gst_rate=?, low_stock_threshold=?, barcode=?, supplier_id=?
    WHERE id=?
  `).run(name, brand || null, salt_composition || null, category || null, is_prescription_required ? 1 : 0, cost_price || null, price, gst_rate || 0, low_stock_threshold || 10, barcode || null, supplier_id || null, req.params.id);

  res.json({ success: true });
});

// Delete medicine (only if no sales history)
router.delete('/:id', (req, res) => {
  const salesCount = db.prepare('SELECT COUNT(*) as c FROM sale_items WHERE medicine_id = ?').get(req.params.id);
  if (salesCount.c > 0) {
    return res.status(400).json({ error: 'Cannot delete medicine with sales history' });
  }
  db.prepare('DELETE FROM medicines WHERE id = ?').run(req.params.id);
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
