import express from 'express';
import { auth } from '../middleware/auth.js';
import db from '../db/connection.js';

const router = express.Router();
router.use(auth);
const csvCell = (value) => {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
};
const sendCsv = (res, filename, headers, rows) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send([headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n'));
};

router.get('/summary', (req, res) => {
  const daysRaw = Number.parseInt(req.query.days, 10);
  const days = Number.isFinite(daysRaw) ? Math.min(366, Math.max(1, daysRaw)) : 30;
  const sales = db.prepare(`
    SELECT COUNT(*) AS invoices, COALESCE(SUM(total_amount), 0) AS gross_revenue
    FROM sales WHERE created_at >= datetime('now', '-' || ? || ' days')
  `).get(days);
  const returns = db.prepare(`
    SELECT COALESCE(SUM(refund_amount), 0) AS refunds
    FROM sale_returns WHERE status = 'approved' AND created_at >= datetime('now', '-' || ? || ' days')
  `).get(days);
  const costs = db.prepare(`
    SELECT COALESCE(SUM(si.quantity * si.cost_price_at_sale), 0) AS cost_of_goods
    FROM sale_items si JOIN sales s ON s.id = si.sale_id
    WHERE s.created_at >= datetime('now', '-' || ? || ' days')
  `).get(days);
  const stock = db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN date(expiry_date) >= date('now') THEN qty ELSE 0 END), 0) AS sellable_units,
      COALESCE(SUM(CASE WHEN date(expiry_date) < date('now') THEN qty ELSE 0 END), 0) AS expired_units
    FROM batches
  `).get();
  const netRevenue = Math.round((sales.gross_revenue - returns.refunds + Number.EPSILON) * 100) / 100;
  const grossProfitEstimate = Math.round((netRevenue - costs.cost_of_goods + Number.EPSILON) * 100) / 100;
  res.json({ period_days: days, invoices: sales.invoices, gross_revenue: sales.gross_revenue,
    approved_refunds: returns.refunds, net_revenue: netRevenue, cost_of_goods_sold: costs.cost_of_goods,
    estimated_gross_profit: grossProfitEstimate, sellable_units: stock.sellable_units, expired_units: stock.expired_units,
    note: 'Profit is an estimate based on captured unit costs and approved refunds; excludes operating expenses and tax adjustments.' });
});

router.get('/sales.csv', (req, res) => {
  const rows = db.prepare(`
    SELECT s.invoice_no, s.created_at, COALESCE(c.name, '') AS customer_name, s.subtotal,
      s.gst_amount, s.total_amount, COALESCE(u.name, '') AS billed_by
    FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
    LEFT JOIN users u ON u.id = s.billed_by ORDER BY s.created_at DESC
  `).all();
  sendCsv(res, 'sales-report.csv', ['invoice_no','created_at','customer_name','subtotal','gst_amount','total_amount','billed_by'],
    rows.map((r) => [r.invoice_no,r.created_at,r.customer_name,r.subtotal,r.gst_amount,r.total_amount,r.billed_by]));
});

router.get('/inventory.csv', (req, res) => {
  const rows = db.prepare(`
    SELECT m.id, m.name, m.brand, m.category,
      COALESCE(SUM(CASE WHEN date(b.expiry_date) >= date('now') THEN b.qty ELSE 0 END), 0) AS sellable_stock,
      COALESCE(SUM(CASE WHEN date(b.expiry_date) < date('now') THEN b.qty ELSE 0 END), 0) AS expired_stock,
      m.cost_price, m.price, m.low_stock_threshold
    FROM medicines m LEFT JOIN batches b ON b.medicine_id = m.id
    GROUP BY m.id ORDER BY m.name
  `).all();
  sendCsv(res, 'inventory-report.csv', ['medicine_id','name','brand','category','sellable_stock','expired_stock','cost_price','selling_price','low_stock_threshold'],
    rows.map((r) => [r.id,r.name,r.brand,r.category,r.sellable_stock,r.expired_stock,r.cost_price,r.price,r.low_stock_threshold]));
});

export default router;
