import db from './connection.js';

// Idempotent startup migration for databases created before these features existed.
db.exec(`
  CREATE TABLE IF NOT EXISTS sale_returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL REFERENCES sales(id),
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    refund_amount REAL NOT NULL DEFAULT 0,
    restock_approved INTEGER NOT NULL DEFAULT 0 CHECK (restock_approved IN (0, 1)),
    requested_by INTEGER REFERENCES users(id),
    reviewed_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME
  );
  CREATE TABLE IF NOT EXISTS sale_return_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    return_id INTEGER NOT NULL REFERENCES sale_returns(id),
    sale_item_id INTEGER NOT NULL REFERENCES sale_items(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    refund_amount REAL NOT NULL CHECK (refund_amount >= 0)
  );
  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_batches_medicine_expiry ON batches(medicine_id, expiry_date);
  CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
`);

const saleItemColumns = db.prepare('PRAGMA table_info(sale_items)').all().map((column) => column.name);
if (!saleItemColumns.includes('cost_price_at_sale')) {
  db.exec('ALTER TABLE sale_items ADD COLUMN cost_price_at_sale REAL NOT NULL DEFAULT 0');
}
if (!saleItemColumns.includes('gst_rate_at_sale')) {
  db.exec('ALTER TABLE sale_items ADD COLUMN gst_rate_at_sale REAL NOT NULL DEFAULT 0');
}
