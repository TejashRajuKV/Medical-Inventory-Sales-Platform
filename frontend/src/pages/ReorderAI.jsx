import { useState, useEffect } from 'react';
import { reorders as reorderApi, sales } from '../api';
import './ReorderAI.css';

export default function ReorderAI() {
  const [suggestions, setSuggestions] = useState([]);
  const [requests, setRequests] = useState([]);
  const [deadStock, setDeadStock] = useState([]);
  const [dailyData, setDailyData] = useState([]);
  const [tab, setTab] = useState('suggestions');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      reorderApi.suggestions(),
      reorderApi.list(),
      sales.deadStock(),
      reorderApi.dailyAnalytics(7)
    ]).then(([sug, req, dead, daily]) => {
      setSuggestions(sug);
      setRequests(req);
      setDeadStock(dead);
      setDailyData(daily);
    }).finally(() => setLoading(false));
  }, []);

  const createReorder = async (s) => {
    try {
      await reorderApi.create({ medicine_id: s.medicine_id, suggested_qty: s.suggested_qty, reason: s.reason });
      const updated = await reorderApi.list();
      setRequests(updated);
    } catch (err) { alert(err.message); }
  };

  const handleAction = async (id, action) => {
    try {
      await reorderApi[action](id);
      const updated = await reorderApi.list();
      setRequests(updated);
    } catch (err) { alert(err.message); }
  };

  if (loading) return <div className="page-title">Loading...</div>;

  return (
    <div>
      <h1 className="page-title">Reorder Intelligence</h1>

      <div className="tab-bar">
        {[['suggestions', 'AI Suggestions'], ['requests', 'Reorder Requests'], ['analytics', 'Analytics'], ['dead', 'Dead Stock']].map(([key, label]) => (
          <button key={key} className={`tab-btn ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {tab === 'suggestions' && (
        <div className="suggestions-list">
          {suggestions.length === 0 && <div className="empty-state"><p>No reorder suggestions right now. Make some sales first to generate demand data.</p></div>}
          {suggestions.map((s, i) => (
            <div key={i} className="suggestion-card">
              <div className="sug-header">
                <div>
                  <div className="sug-name">{s.name}</div>
                  <div className="sug-brand">{s.brand}</div>
                </div>
                <div className="sug-qty">
                  <div className="sug-qty-value">{s.suggested_qty}</div>
                  <div className="sug-qty-label">units suggested</div>
                </div>
              </div>
              <div className="sug-reason">
                <div className="sug-reason-title">AI Reasoning</div>
                <pre className="sug-reason-text">{s.reason}</pre>
              </div>
              <div className="sug-stats">
                <div><span className="sug-stat-label">Current stock</span><span className="sug-stat-val">{s.total_stock}</span></div>
                <div><span className="sug-stat-label">Avg monthly</span><span className="sug-stat-val">{s.avg_monthly_sales}</span></div>
                <div><span className="sug-stat-label">Trend</span><span className={`sug-stat-val ${s.trend_pct > 0 ? 'trend-up' : s.trend_pct < 0 ? 'trend-down' : ''}`}>{s.trend_pct > 0 ? '+' : ''}{s.trend_pct}%</span></div>
                <div><span className="sug-stat-label">Expiring soon</span><span className="sug-stat-val">{s.expiring_soon}</span></div>
              </div>
              <button className="btn-primary btn-sm-full" onClick={() => createReorder(s)}>Create Reorder Request</button>
            </div>
          ))}
        </div>
      )}

      {tab === 'requests' && (
        <div className="med-table-wrap">
          <table className="med-table">
            <thead><tr><th>Medicine</th><th>Qty</th><th>Status</th><th>Reviewed By</th><th>Date</th><th>Actions</th></tr></thead>
            <tbody>
              {requests.map(r => (
                <tr key={r.id}>
                  <td className="med-name">{r.medicine_name}</td>
                  <td>{r.suggested_qty}</td>
                  <td><span className={`badge badge-${r.status === 'approved' ? 'cat' : r.status === 'rejected' ? 'red' : 'amber'}`}>{r.status}</span></td>
                  <td>{r.reviewed_by_name || '—'}</td>
                  <td className="date-cell">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="med-actions">
                    {r.status === 'pending' && (
                      <>
                        <button className="btn-sm btn-sm-ghost" onClick={() => handleAction(r.id, 'approve')}>Approve</button>
                        <button className="btn-sm btn-sm-danger" onClick={() => handleAction(r.id, 'reject')}>Reject</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {requests.length === 0 && <tr><td colSpan="6" className="empty-row">No reorder requests.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'analytics' && (
        <div className="analytics-grid">
          <div className="dash-card">
            <h2 className="dash-card-title">Daily Revenue (Last 7 days)</h2>
            {dailyData.length === 0 ? <p className="dash-empty">No data.</p> : (
              <div className="bar-chart">
                {dailyData.map(d => {
                  const maxRev = Math.max(...dailyData.map(x => x.revenue), 1);
                  const h = (d.revenue / maxRev) * 120;
                  return (
                    <div key={d.date} className="bar-col">
                      <div className="bar" style={{ height: h }} title={`₹${d.revenue}`} />
                      <div className="bar-label">{d.date?.slice(5)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="dash-card">
            <h2 className="dash-card-title">Quick Stats</h2>
            <div className="quick-stats">
              <div className="qs-item"><div className="qs-val">{dailyData.reduce((s, d) => s + (d.invoices || 0), 0)}</div><div className="qs-label">Invoices (7d)</div></div>
              <div className="qs-item"><div className="qs-val">₹{dailyData.reduce((s, d) => s + (d.revenue || 0), 0).toLocaleString()}</div><div className="qs-label">Revenue (7d)</div></div>
              <div className="qs-item"><div className="qs-val">{dailyData.reduce((s, d) => s + (d.units_sold || 0), 0)}</div><div className="qs-label">Units Sold (7d)</div></div>
            </div>
          </div>
        </div>
      )}

      {tab === 'dead' && (
        <div className="med-table-wrap">
          <table className="med-table">
            <thead><tr><th>Medicine</th><th>Category</th><th>Stock</th><th>Last Sold</th></tr></thead>
            <tbody>
              {deadStock.map(d => (
                <tr key={d.id}>
                  <td className="med-name">{d.name}</td>
                  <td><span className="badge-cat">{d.category}</span></td>
                  <td className="stock-low">{d.total_stock}</td>
                  <td className="date-cell">{d.last_sold ? new Date(d.last_sold).toLocaleDateString() : 'Never'}</td>
                </tr>
              ))}
              {deadStock.length === 0 && <tr><td colSpan="4" className="empty-row">No dead stock — all items selling.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}