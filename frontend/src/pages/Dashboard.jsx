import { useState, useEffect } from 'react';
import { medicines } from '../api';
import FreshnessDot from '../components/FreshnessDot';
import './Dashboard.css';

export default function Dashboard() {
  const [medList, setMedList] = useState([]);
  const [stats, setStats] = useState({ total: 0, lowStock: 0, nearExpiry: 0, totalValue: 0 });

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const data = await medicines.list();
    setMedList(data);

    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    let lowStock = 0, nearExpiry = 0, totalValue = 0;
    for (const m of data) {
      if (m.total_stock <= m.low_stock_threshold) lowStock++;
      if (m.nearest_expiry && new Date(m.nearest_expiry) <= thirtyDays) nearExpiry++;
      totalValue += m.total_stock * m.price;
    }
    setStats({ total: data.length, lowStock, nearExpiry, totalValue });
  };

  const lowStockMeds = medList.filter(m => m.total_stock <= m.low_stock_threshold);
  const expiringMeds = medList.filter(m => {
    if (!m.nearest_expiry) return false;
    const d = new Date(m.nearest_expiry);
    const threshold = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    return d <= threshold;
  }).sort((a, b) => new Date(a.nearest_expiry) - new Date(b.nearest_expiry));

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>

      <div className="stats-grid">
        <StatCard label="Total Medicines" value={stats.total} />
        <StatCard label="Low Stock Alerts" value={stats.lowStock} color="amber" />
        <StatCard label="Near Expiry" value={stats.nearExpiry} color="red" />
        <StatCard label="Inventory Value" value={`₹${stats.totalValue.toLocaleString()}`} />
      </div>

      <div className="dash-grid">
        <section className="dash-card">
          <h2 className="dash-card-title">Low Stock Items</h2>
          {lowStockMeds.length === 0 ? (
            <p className="dash-empty">All items are above threshold.</p>
          ) : (
            <div className="dash-list">
              {lowStockMeds.map(m => (
                <div key={m.id} className="dash-list-item">
                  <div>
                    <div className="dash-item-name">{m.name}</div>
                    <div className="dash-item-sub">{m.brand}</div>
                  </div>
                  <span className="badge badge-amber">{m.total_stock} left</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="dash-card">
          <h2 className="dash-card-title">Expiry Watch</h2>
          {expiringMeds.length === 0 ? (
            <p className="dash-empty">No items expiring within 90 days.</p>
          ) : (
            <div className="dash-list">
              {expiringMeds.map(m => (
                <div key={m.id} className="dash-list-item">
                  <div>
                    <div className="dash-item-name">{m.name}</div>
                    <div className="dash-item-sub">{m.brand}</div>
                  </div>
                  <FreshnessDot expiryDate={m.nearest_expiry} />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className={`stat-card ${color === 'amber' ? 'stat-amber' : ''} ${color === 'red' ? 'stat-red' : ''}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}