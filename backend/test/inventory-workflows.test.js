import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

let db;
let server;
let baseUrl;
let ownerToken;
let staffToken;
let medicineId;
let batchId;
let saleId;
let tempDir;

const authHeaders = (token) => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });
const request = (url, token, options = {}) => fetch(baseUrl + url, {
  ...options,
  headers: { ...authHeaders(token), ...(options.headers || {}) },
});
const json = (method, body) => ({ method, body: JSON.stringify(body) });

before(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medical-inventory-tests-'));
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_PATH = path.join(tempDir, 'test.sqlite');
  process.env.JWT_SECRET = 'test-only-secret-change-me';
  const { default: database } = await import('../src/db/connection.js');
  db = database;
  const schema = fs.readFileSync(new URL('../src/db/schema.sql', import.meta.url), 'utf8');
  db.exec(schema);
  const { default: app } = await import('../src/app.js');

  const passwordHash = bcrypt.hashSync('test-password-123', 4);
  const owner = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)').run('Test Owner', 'owner@test.invalid', passwordHash, 'owner');
  const staff = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)').run('Test Staff', 'staff@test.invalid', passwordHash, 'staff');
  ownerToken = jwt.sign({ id: Number(owner.lastInsertRowid), role: 'owner' }, process.env.JWT_SECRET);
  staffToken = jwt.sign({ id: Number(staff.lastInsertRowid), role: 'staff' }, process.env.JWT_SECRET);

  const supplier = db.prepare('INSERT INTO suppliers (name) VALUES (?)').run('Test Supplier');
  const medicine = db.prepare('INSERT INTO medicines (name, cost_price, price, gst_rate, low_stock_threshold, supplier_id) VALUES (?, ?, ?, ?, ?, ?)').run('Test Medicine', 4, 10, 0, 2, Number(supplier.lastInsertRowid));
  medicineId = Number(medicine.lastInsertRowid);
  const batch = db.prepare('INSERT INTO batches (medicine_id, batch_no, expiry_date, qty, cost_price) VALUES (?, ?, ?, ?, ?)').run(medicineId, 'TEST-VALID-01', '2027-12-31', 10, 4);
  batchId = Number(batch.lastInsertRowid);
  db.prepare('INSERT INTO batches (medicine_id, batch_no, expiry_date, qty, cost_price) VALUES (?, ?, ?, ?, ?)').run(medicineId, 'TEST-EXPIRED-01', '2026-01-01', 50, 3);

  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  if (db?.open) db.close();
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
});

test('protected endpoints reject requests without a token', async () => {
  const response = await fetch(baseUrl + '/api/medicines');
  assert.equal(response.status, 401);
});

test('medicine creation rejects negative prices and invalid GST', async () => {
  const response = await request('/api/medicines', ownerToken, json('POST', { name: 'Bad Medicine', price: -1, gst_rate: 5 }));
  assert.equal(response.status, 400);
  const response2 = await request('/api/medicines', ownerToken, json('POST', { name: 'Bad GST', price: 10, gst_rate: 150 }));
  assert.equal(response2.status, 400);
});

test('billing cannot sell expired units, even when expired quantity is larger', async () => {
  const response = await request('/api/sales', ownerToken, json('POST', { items: [{ medicine_id: medicineId, quantity: 11 }] }));
  assert.equal(response.status, 201);
  const sale = await response.json();
  saleId = sale.saleId;
  assert.equal(sale.items.reduce((sum, item) => sum + item.quantity, 0), 11);
  const validStock = db.prepare('SELECT qty FROM batches WHERE id = ?').get(batchId).qty;
  assert.equal(validStock, 0);
  const expired = db.prepare("SELECT qty FROM batches WHERE batch_no = 'TEST-EXPIRED-01'").get().qty;
  assert.equal(expired, 50);
});

test('stock adjustments reject non-integer and negative resulting stock', async () => {
  const response = await request('/api/stock-adjustments', ownerToken, json('POST', { batch_id: batchId, qty_change: -1, reason: 'test correction' }));
  assert.equal(response.status, 400);
  const fractional = await request('/api/stock-adjustments', ownerToken, json('POST', { batch_id: batchId, qty_change: 1.5, reason: 'fractional' }));
  assert.equal(fractional.status, 400);
});

test('purchase order receipt rejects malformed batches and expired stock', async () => {
  const supplierId = db.prepare('SELECT supplier_id FROM medicines WHERE id = ?').get(medicineId).supplier_id;
  const po = db.prepare('INSERT INTO purchase_orders (supplier_id) VALUES (?)').run(supplierId);
  const response = await request(`/api/purchase-orders/${po.lastInsertRowid}/receive`, ownerToken, json('POST', {
    batches: [{ medicine_id: medicineId, batch_no: 'OLD', expiry_date: '2026-01-01', qty: 5, cost_price: 4 }]
  }));
  assert.equal(response.status, 400);
  assert.equal(db.prepare('SELECT status FROM purchase_orders WHERE id = ?').get(po.lastInsertRowid).status, 'ordered');
});

test('return requests reject quantities above sold quantity', async () => {
  const saleItem = db.prepare('SELECT id, quantity FROM sale_items WHERE sale_id = ? LIMIT 1').get(saleId);
  const response = await request('/api/returns', ownerToken, json('POST', {
    sale_id: saleId, reason: 'test return', items: [{ sale_item_id: saleItem.id, quantity: saleItem.quantity + 1 }]
  }));
  assert.equal(response.status, 400);
});

test('staff cannot access owner-only audit history or approve refunds', async () => {
  const audit = await request('/api/audit-logs', staffToken);
  assert.equal(audit.status, 403);
  const review = await request('/api/returns/1/review', staffToken, json('POST', { decision: 'approve', restock: false }));
  assert.equal(review.status, 403);
});

test('report endpoints return summary JSON and downloadable CSV', async () => {
  const summary = await request('/api/reports/summary?days=30', ownerToken);
  assert.equal(summary.status, 200);
  const data = await summary.json();
  assert.ok('estimated_gross_profit' in data);
  const csv = await request('/api/reports/inventory.csv', ownerToken);
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('content-type'), /text\/csv/);
  assert.match(await csv.text(), /sellable_stock,expired_stock/);
});
