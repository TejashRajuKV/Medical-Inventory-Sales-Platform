-- Users (pharmacy owner / staff)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'owner',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Medicines / Tablets
CREATE TABLE IF NOT EXISTS medicines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    brand TEXT,
    salt_composition TEXT,
    category TEXT,
    is_prescription_required BOOLEAN DEFAULT 0,
    cost_price REAL,
    price REAL NOT NULL,
    gst_rate REAL DEFAULT 0,
    low_stock_threshold INTEGER DEFAULT 10,
    image_url TEXT,
    barcode TEXT,
    supplier_id INTEGER REFERENCES suppliers(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Batches
CREATE TABLE IF NOT EXISTS batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    medicine_id INTEGER REFERENCES medicines(id),
    purchase_order_id INTEGER REFERENCES purchase_orders(id),
    batch_no TEXT NOT NULL,
    expiry_date TEXT NOT NULL,
    qty INTEGER NOT NULL DEFAULT 0,
    cost_price REAL,
    received_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Purchase orders
CREATE TABLE IF NOT EXISTS purchase_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER REFERENCES suppliers(id),
    reorder_request_id INTEGER REFERENCES reorder_requests(id),
    status TEXT DEFAULT 'ordered',
    ordered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    received_at TEXT
);

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact_info TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Stock adjustment log
CREATE TABLE IF NOT EXISTS stock_adjustments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER REFERENCES batches(id),
    qty_change INTEGER NOT NULL,
    reason TEXT NOT NULL,
    adjusted_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Drug interaction rules
CREATE TABLE IF NOT EXISTS drug_interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    medicine_a_id INTEGER REFERENCES medicines(id),
    medicine_b_id INTEGER REFERENCES medicines(id),
    severity TEXT,
    description TEXT
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    phone TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sales / Billing
CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_no TEXT UNIQUE,
    customer_id INTEGER REFERENCES customers(id),
    subtotal REAL NOT NULL,
    gst_amount REAL DEFAULT 0,
    total_amount REAL NOT NULL,
    billed_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sale items
CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER REFERENCES sales(id),
    medicine_id INTEGER REFERENCES medicines(id),
    batch_id INTEGER REFERENCES batches(id),
    quantity INTEGER NOT NULL,
    price_at_sale REAL NOT NULL
);

-- Reorder requests
CREATE TABLE IF NOT EXISTS reorder_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    medicine_id INTEGER REFERENCES medicines(id),
    suggested_qty INTEGER,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_by INTEGER REFERENCES users(id)
);

-- Alerts / Notifications
CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    medicine_id INTEGER REFERENCES medicines(id),
    type TEXT,
    message TEXT,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_read BOOLEAN DEFAULT 0
);

-- Triggers: auto-update updated_at
CREATE TRIGGER IF NOT EXISTS medicines_updated_at
AFTER UPDATE ON medicines
FOR EACH ROW
BEGIN
    UPDATE medicines SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS suppliers_updated_at
AFTER UPDATE ON suppliers
FOR EACH ROW
BEGIN
    UPDATE suppliers SET contact_info = NEW.contact_info WHERE id = OLD.id;
END;

-- Returns and refunds. Returned stock is only re-added after explicit inspection.
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
