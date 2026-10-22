import express from 'express';
import { auth, ownerOnly } from '../middleware/auth.js';
import db from '../db/connection.js';
import { auditLog } from '../utils/audit.js';

const router = express.Router();
router.use(auth);
const positiveInt = (v) => Number.isSafeInteger(Number(v)) && Number(v) > 0;
const money = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT r.*, s.invoice_no, u.name AS requested_by_name, reviewer.name AS reviewed_by_name
    FROM sale_returns r
    JOIN sales s ON s.id = r.sale_id
    LEFT JOIN users u ON u.id = r.requested_by
    LEFT JOIN users reviewer ON reviewer.id = r.reviewed_by
    ORDER BY r.created_at DESC
  `).all();
  res.json(rows);
});

router.get('/:id', (req, res) => {
  if (!positiveInt(req.params.id)) return res.status(400).json({ error: 'Invalid return ID' });
  const row = db.prepare('SELECT * FROM sale_returns WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Return not found' });
  const items = db.prepare(`
    SELECT ri.*, si.medicine_id, si.batch_id, m.name AS medicine_name, b.batch_no, b.expiry_date
    FROM sale_return_items ri
    JOIN sale_items si ON si.id = ri.sale_item_id
    JOIN medicines m ON m.id = si.medicine_id
    JOIN batches b ON b.id = si.batch_id
    WHERE ri.return_id = ?
  `).all(row.id);
  res.json({ ...row, items });
});

router.post('/', (req, res) => {
  const { sale_id, reason, items } = req.body ?? {};
  if (!positiveInt(sale_id) || typeof reason !== 'string' || !reason.trim() || reason.trim().length > 500 ||
      !Array.isArray(items) || items.length === 0 || items.length > 100 ||
      items.some((i) => !i || !positiveInt(i.sale_item_id) || !positiveInt(i.quantity))) {
    return res.status(400).json({ error: 'sale_id, reason and valid return items are required' });
  }
  try {
    const result = db.transaction(() => {
      const sale = db.prepare('SELECT id FROM sales WHERE id = ?').get(Number(sale_id));
      if (!sale) throw new Error('Sale not found');
      const merged = new Map();
      for (const item of items) merged.set(Number(item.sale_item_id), (merged.get(Number(item.sale_item_id)) || 0) + Number(item.quantity));
      let refundTotal = 0;
      const computed = [];
      for (const [saleItemId, quantity] of merged) {
        const sold = db.prepare(`
          SELECT si.*, COALESCE(NULLIF(si.gst_rate_at_sale, 0), m.gst_rate) AS gst_rate FROM sale_items si
          JOIN medicines m ON m.id = si.medicine_id
          WHERE si.id = ? AND si.sale_id = ?
        `).get(saleItemId, Number(sale_id));
        if (!sold) throw new Error('Return item does not belong to this sale');
        const alreadyReturned = db.prepare(`
          SELECT COALESCE(SUM(ri.quantity), 0) AS qty
          FROM sale_return_items ri JOIN sale_returns r ON r.id = ri.return_id
          WHERE ri.sale_item_id = ? AND r.status IN ('pending', 'approved')
        `).get(saleItemId).qty;
        if (quantity > sold.quantity - alreadyReturned) throw new Error('Return quantity exceeds the unreturned sold quantity');
        const refund = money(quantity * sold.price_at_sale * (1 + (Number(sold.gst_rate || 0) / 100)));
        refundTotal += refund;
        computed.push({ saleItemId, quantity, refund });
      }
      const r = db.prepare('INSERT INTO sale_returns (sale_id, reason, refund_amount, requested_by) VALUES (?, ?, ?, ?)')
        .run(Number(sale_id), reason.trim(), money(refundTotal), req.user.id);
      const insert = db.prepare('INSERT INTO sale_return_items (return_id, sale_item_id, quantity, refund_amount) VALUES (?, ?, ?, ?)');
      for (const item of computed) insert.run(r.lastInsertRowid, item.saleItemId, item.quantity, item.refund);
      auditLog(req.user.id, 'return.requested', 'sale_return', r.lastInsertRowid, { sale_id: Number(sale_id), refund_amount: money(refundTotal) });
      return { id: r.lastInsertRowid, refund_amount: money(refundTotal), status: 'pending' };
    })();
    res.status(201).json(result);
  } catch (err) {
    res.status(err.message === 'Sale not found' ? 404 : 400).json({ error: err.message });
  }
});

// Only an owner can approve/reject a refund. Returned stock is quarantined unless restock=true
// and the original batch is still in date.
router.post('/:id/review', ownerOnly, (req, res) => {
  const { decision, restock = false } = req.body ?? {};
  if (!positiveInt(req.params.id) || !['approve', 'reject'].includes(decision) || typeof restock !== 'boolean') {
    return res.status(400).json({ error: 'Valid return ID, decision and restock flag required' });
  }
  try {
    db.transaction(() => {
      const ret = db.prepare('SELECT * FROM sale_returns WHERE id = ?').get(Number(req.params.id));
      if (!ret) throw new Error('Return not found');
      if (ret.status !== 'pending') throw new Error('Return has already been reviewed');
      if (decision === 'approve' && restock) {
        const items = db.prepare(`
          SELECT ri.quantity, si.batch_id, b.expiry_date
          FROM sale_return_items ri
          JOIN sale_items si ON si.id = ri.sale_item_id
          JOIN batches b ON b.id = si.batch_id
          WHERE ri.return_id = ?
        `).all(ret.id);
        if (items.some((i) => String(i.expiry_date) < new Date().toISOString().slice(0, 10))) {
          throw new Error('Expired items cannot be returned to sellable stock');
        }
        for (const item of items) db.prepare('UPDATE batches SET qty = qty + ? WHERE id = ?').run(item.quantity, item.batch_id);
      }
      db.prepare('UPDATE sale_returns SET status = ?, restock_approved = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(decision === 'approve' ? 'approved' : 'rejected', decision === 'approve' && restock ? 1 : 0, req.user.id, ret.id);
      auditLog(req.user.id, decision === 'approve' ? 'return.approved' : 'return.rejected', 'sale_return', ret.id, { restock: decision === 'approve' && restock, refund_amount: ret.refund_amount });
    })();
    res.json({ success: true, status: decision === 'approve' ? 'approved' : 'rejected', restocked: decision === 'approve' && restock });
  } catch (err) {
    res.status(err.message === 'Return not found' ? 404 : 400).json({ error: err.message });
  }
});

export default router;
