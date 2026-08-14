import express from 'express';
import { auth } from '../middleware/auth.js';
import db from '../db/connection.js';

const router = express.Router();
router.use(auth);

// Get reorder suggestions with AI-style reasoning
router.get('/suggestions', (req, res) => {
  // Monthly demand analysis per medicine
  const demandData = db.prepare(`
    SELECT si.medicine_id, m.name, m.brand, m.price, m.gst_rate, m.low_stock_threshold,
      COALESCE(SUM(b.qty), 0) as total_stock,
      COUNT(DISTINCT DATE(s.created_at)) as sale_days,
      SUM(si.quantity) as total_sold,
      MIN(b.expiry_date) as nearest_expiry
    FROM medicines m
    LEFT JOIN batches b ON b.medicine_id = m.id
    LEFT JOIN sale_items si ON si.medicine_id = m.id
    LEFT JOIN sales s ON s.id = si.sale_id AND s.created_at >= DATE('now', '-90 days')
    GROUP BY m.id
    HAVING total_stock > 0
  `).all();

  // Also get medicines with zero stock that have sales history
  const zeroStock = db.prepare(`
    SELECT si.medicine_id, m.name, m.brand, m.price, m.gst_rate, m.low_stock_threshold,
      0 as total_stock,
      SUM(si.quantity) as total_sold,
      MIN(b2.expiry_date) as nearest_expiry
    FROM medicines m
    JOIN sale_items si ON si.medicine_id = m.id
    JOIN sales s ON s.id = si.sale_id AND s.created_at >= DATE('now', '-90 days')
    LEFT JOIN batches b2 ON b2.medicine_id = m.id
    WHERE NOT EXISTS (SELECT 1 FROM batches b WHERE b.medicine_id = m.id AND b.qty > 0)
    GROUP BY m.id
  `).all();

  const all = [...demandData, ...zeroStock];
  const suggestions = [];

  for (const item of all) {
    const daysInWindow = 90;
    const avgMonthly = item.sale_days > 0
      ? Math.round((item.total_sold / daysInWindow) * 30)
      : 0;

    // Simple trend: compare last 30 days vs previous 60 days
    const recent = db.prepare(`
      SELECT COALESCE(SUM(si.quantity), 0) as qty
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE si.medicine_id = ? AND s.created_at >= DATE('now', '-30 days')
    `).get(item.medicine_id);

    const older = db.prepare(`
      SELECT COALESCE(SUM(si.quantity), 0) as qty
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE si.medicine_id = ? AND s.created_at BETWEEN DATE('now', '-90 days') AND DATE('now', '-30 days')
    `).get(item.medicine_id);

    const olderMonthly = older.qty / 60 * 30;
    let trendPct = 0;
    if (olderMonthly > 0) {
      trendPct = Math.round(((recent.qty / 30 * 30 - olderMonthly) / olderMonthly) * 100);
    }

    // Expiring units within 30 days
    const expiringSoon = db.prepare(`
      SELECT COALESCE(SUM(qty), 0) as qty FROM batches
      WHERE medicine_id = ? AND expiry_date BETWEEN DATE('now') AND DATE('now', '+30 days')
    `).get(item.medicine_id).qty;

    const effectiveStock = item.total_stock - expiringSoon;
    const expectedDemand = avgMonthly > 0
      ? Math.round(avgMonthly * (1 + (trendPct > 0 ? trendPct / 100 : 0.1)))
      : 0;

    let suggestedQty = 0;
    if (avgMonthly > 0 && (effectiveStock <= avgMonthly * 1.5 || item.total_stock <= item.low_stock_threshold)) {
      suggestedQty = Math.max(0, expectedDemand - effectiveStock);
      // Round up to nearest 10
      suggestedQty = Math.ceil(suggestedQty / 10) * 10;
    }

    // Expiry risk items
    const expiryRisk = db.prepare(`
      SELECT COALESCE(SUM(qty), 0) as qty FROM batches
      WHERE medicine_id = ? AND expiry_date <= DATE('now', '+30 days')
    `).get(item.medicine_id).qty;

    if (suggestedQty > 0 || expiryRisk > 0) {
      suggestions.push({
        medicine_id: item.medicine_id,
        name: item.name,
        brand: item.brand,
        total_stock: item.total_stock,
        avg_monthly_sales: avgMonthly,
        trend_pct: trendPct,
        expiring_soon: expiringSoon,
        effective_stock: effectiveStock,
        expected_demand: expectedDemand,
        suggested_qty: suggestedQty,
        expiry_risk_qty: expiryRisk,
        nearest_expiry: item.nearest_expiry,
        reason: suggestedQty > 0
          ? `Average monthly sales: ${avgMonthly} units. ${trendPct !== 0 ? `Trend: ${trendPct > 0 ? '+' : ''}${trendPct}%. ` : ''}Current stock: ${item.total_stock}. ${expiringSoon > 0 ? `${expiringSoon} units expiring within 30 days. ` : ''}Expected next-month demand: ${expectedDemand}. Suggested order: ${suggestedQty}.`
          : `${expiryRisk} units expiring within 30 days — consider clearance.`
      });
    }
  }

  suggestions.sort((a, b) => b.suggested_qty - a.suggested_qty);
  res.json(suggestions);
});

// List reorder requests
router.get('/', (req, res) => {
  const requests = db.prepare(`
    SELECT rr.*, m.name as medicine_name, m.brand,
      u.name as reviewed_by_name
    FROM reorder_requests rr
    JOIN medicines m ON m.id = rr.medicine_id
    LEFT JOIN users u ON u.id = rr.reviewed_by
    ORDER BY rr.created_at DESC
  `).all();
  res.json(requests);
});

// Create reorder request from a suggestion
router.post('/', (req, res) => {
  const { medicine_id, suggested_qty, reason } = req.body;
  if (!medicine_id) return res.status(400).json({ error: 'Medicine ID required' });

  // Check for existing pending request
  const existing = db.prepare(
    "SELECT id FROM reorder_requests WHERE medicine_id = ? AND status = 'pending'"
  ).get(medicine_id);
  if (existing) return res.status(409).json({ error: 'Pending request already exists for this medicine' });

  const r = db.prepare(
    'INSERT INTO reorder_requests (medicine_id, suggested_qty) VALUES (?, ?)'
  ).run(medicine_id, suggested_qty || 0);
  res.status(201).json({ id: r.lastInsertRowid });
});

// Approve — creates a purchase order
router.post('/:id/approve', (req, res) => {
  const rr = db.prepare('SELECT * FROM reorder_requests WHERE id = ?').get(req.params.id);
  if (!rr) return res.status(404).json({ error: 'Not found' });
  if (rr.status !== 'pending') return res.status(400).json({ error: `Already ${rr.status}` });

  const med = db.prepare('SELECT supplier_id FROM medicines WHERE id = ?').get(rr.medicine_id);
  const supplierId = med?.supplier_id || req.body.supplier_id;
  if (!supplierId) return res.status(400).json({ error: 'No supplier assigned — set one on the medicine first' });

  db.transaction(() => {
 const po = db.prepare('INSERT INTO purchase_orders (supplier_id, reorder_request_id) VALUES (?, ?)')
      .run(supplierId, req.params.id);
    db.prepare("UPDATE reorder_requests SET status = 'approved', reviewed_by = ? WHERE id = ?")
      .run(req.user.id, req.params.id);
  })();

  res.json({ success: true, message: 'Purchase order created' });
});

// Reject
router.post('/:id/reject', (req, res) => {
  db.prepare("UPDATE reorder_requests SET status = 'rejected', reviewed_by = ? WHERE id = ?")
    .run(req.user.id, req.params.id);
  res.json({ success: true });
});

export default router;
