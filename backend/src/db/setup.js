import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import db from './connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Run schema
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
db.exec(schema);

// Seed owner account
const ownerExists = db.prepare('SELECT id FROM users WHERE email = ?').get('owner@pharma.com');
if (!ownerExists) {
  const initialPassword = process.env.OWNER_INITIAL_PASSWORD;
  if (typeof initialPassword !== 'string' || initialPassword.length < 12) throw new Error('Set OWNER_INITIAL_PASSWORD to a unique password of at least 12 characters before setup.');
  const hash = bcrypt.hashSync(initialPassword, 12);
  db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
    .run('Pharmacy Owner', 'owner@pharma.com', hash, 'owner');
  console.log('Owner account created: owner@pharma.com (password supplied via environment).');
}

// Seed sample suppliers
const suppliers = [
  ['MediCorp Distributors', 'contact@medicorp.com, +91-9876543210'],
  ['HealthLine Pharma', 'info@healthline.in, +91-9123456789'],
  ['QuickMeds Supply', 'sales@quickmeds.in, +91-9988776655']
];

const insertSupplier = db.prepare('INSERT OR IGNORE INTO suppliers (name, contact_info) VALUES (?, ?)');
for (const [name, contact] of suppliers) {
  insertSupplier.run(name, contact);
}
console.log('✅ Suppliers seeded:', suppliers.length);

// Seed sample medicines
const medicines = [
  ['Paracetamol 500mg', 'Dolo', 'Paracetamol 500mg', 'Antipyretic', 0, 15, 25, 5, 20, null, null, 1],
  ['Amoxicillin 250mg', 'Mox', 'Amoxicillin 250mg', 'Antibiotic', 1, 45, 65, 12, 15, null, null, 1],
  ['Omeprazole 20mg', 'Omez', 'Omeprazole 20mg', 'Antacid', 0, 22, 35, 5, 15, null, null, 2],
  ['Cetirizine 10mg', 'Zyrtec', 'Cetirizine 10mg', 'Antihistamine', 0, 18, 30, 5, 25, null, null, 2],
  ['Metformin 500mg', 'Glycomet', 'Metformin 500mg', 'Antidiabetic', 1, 28, 45, 5, 20, null, null, 1],
  ['Azithromycin 500mg', 'Azithral', 'Azithromycin 500mg', 'Antibiotic', 1, 55, 80, 12, 10, null, null, 3],
  ['Ibuprofen 400mg', 'Brufen', 'Ibuprofen 400mg', 'NSAID', 0, 20, 35, 5, 30, null, null, null],
  ['Pantoprazole 40mg', 'Pan-D', 'Pantoprazole 40mg + Domperidone 30mg', 'Antacid', 0, 38, 55, 5, 15, null, null, 2],
  ['Cough Syrup 100ml', 'Benadryl', 'Diphenhydramine + Ammonium Chloride + Sodium Citrate', 'Cough Suppressant', 0, 42, 60, 5, 12, null, null, null],
  ['Vitamin D3 60K IU', 'D-Rise', 'Cholecalciferol 60000 IU', 'Supplement', 0, 35, 55, 5, 20, null, null, 3]
];

const insertMedicine = db.prepare(`
  INSERT OR IGNORE INTO medicines (name, brand, salt_composition, category, is_prescription_required, cost_price, price, gst_rate, low_stock_threshold, image_url, barcode, supplier_id)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
for (const m of medicines) {
  insertMedicine.run(...m);
}
console.log('✅ Medicines seeded:', medicines.length);

// Seed sample batches — explicitly mapped to medicine names
const insertBatch = db.prepare('INSERT INTO batches (medicine_id, batch_no, expiry_date, qty, cost_price) VALUES (?, ?, ?, ?, ?)');

const batchMap = {
  'Paracetamol 500mg': [
    ['B-PC-001', '2026-11-30', 150, 15],
    ['B-PC-002', '2027-06-30', 200, 14],
  ],
  'Amoxicillin 250mg': [
    ['B-AM-001', '2026-09-15', 40, 45],
    ['B-AM-002', '2027-03-01', 80, 43],
  ],
  'Omeprazole 20mg': [['B-OM-001', '2027-01-15', 60, 22]],
  'Cetirizine 10mg': [
    ['B-CZ-001', '2026-12-31', 100, 18],
    ['B-CZ-002', '2027-08-01', 120, 17],
  ],
  'Metformin 500mg': [['B-MF-001', '2027-04-30', 50, 28]],
  'Azithromycin 500mg': [['B-AZ-001', '2026-10-01', 25, 55]],
  'Ibuprofen 400mg': [['B-IB-001', '2027-02-28', 90, 20]],
  'Pantoprazole 40mg': [['B-PT-001', '2026-12-15', 45, 38]],
  'Cough Syrup 100ml': [
    ['B-CS-001', '2026-08-20', 30, 42],
    ['B-CS-002', '2027-05-01', 50, 40],
  ],
  'Vitamin D3 60K IU': [['B-VD-001', '2028-01-31', 80, 35]],
};

let batchCount = 0;
for (const med of db.prepare('SELECT id, name FROM medicines').all()) {
  const batches = batchMap[med.name];
  if (!batches) continue;
  for (const [batchNo, expiry, qty, cost] of batches) {
    insertBatch.run(med.id, batchNo, expiry, qty, cost);
    batchCount++;
  }
}
console.log('✅ Batches seeded:', batchCount);

console.log('\n🟢 Database setup complete.');
db.close();
