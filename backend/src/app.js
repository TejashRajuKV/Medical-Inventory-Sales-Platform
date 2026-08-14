import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import medicineRoutes from './routes/medicines.js';
import salesRoutes from './routes/sales.js';
import customerRoutes from './routes/customers.js';
import stockAdjRoutes from './routes/stockAdjustments.js';
import alertRoutes from './routes/alerts.js';
import supplierRoutes from './routes/suppliers.js';
import poRoutes from './routes/purchaseOrders.js';
import reorderRoutes from './routes/reorders.js';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/stock-adjustments', stockAdjRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchase-orders', poRoutes);
app.use('/api/reorders', reorderRoutes);

process.on('uncaughtException', (err) => { console.error('UNCAUGHT:', err); process.exit(1); });
process.on('unhandledRejection', (err) => { console.error('UNHANDLED:', err); });

import { startAlertService } from './services/alertService.js';

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startAlertService();
});
