import { useEffect, useState } from 'react';
import { reports } from '../api';

const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function Reports() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    reports.summary(days).then((result) => {
      if (active) { setData(result); setError(''); }
    }).catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [days]);

  const exportCsv = async (kind) => {
    setExporting(true);
    try {
      const path = kind === 'sales' ? '/api/reports/sales.csv' : '/api/reports/inventory.csv';
      const filename = kind === 'sales' ? 'sales-report.csv' : 'inventory-report.csv';
      await reports.downloadCsv(path, filename);
    } catch (err) { setError(err.message); }
    finally { setExporting(false); }
  };

  const metrics = data ? [
    ['Invoices', data.invoices],
    ['Gross revenue', money(data.gross_revenue)],
    ['Approved refunds', money(data.approved_refunds)],
    ['Net revenue', money(data.net_revenue)],
    ['Cost of goods sold', money(data.cost_of_goods_sold)],
    ['Estimated gross profit', money(data.estimated_gross_profit)],
    ['Sellable units', data.sellable_units],
    ['Expired units', data.expired_units],
  ] : [];

  return (
    <section>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,flexWrap:'wrap'}}>
        <div><h1 className="page-title">Reports & Exports</h1><p>Revenue, estimated margin and inventory snapshots.</p></div>
        <label>Period{' '}
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option><option value={365}>Last 365 days</option>
          </select>
        </label>
      </div>
      <div style={{display:'flex',gap:12,flexWrap:'wrap',margin:'20px 0'}}>
        <button className="btn-primary" onClick={() => exportCsv('sales')} disabled={exporting}>Export sales CSV</button>
        <button className="btn-secondary" onClick={() => exportCsv('inventory')} disabled={exporting}>Export inventory CSV</button>
      </div>
      {loading && <p>Loading report…</p>}
      {error && <p role="alert" style={{color:'var(--color-danger, #b91c1c)'}}>{error}</p>}
      {!loading && data && <>
        <div className="stats-grid">
          {metrics.map(([label, value]) => <div className="stat-card" key={label}>
            <div className="stat-value" style={{fontSize:22}}>{value}</div><div className="stat-label">{label}</div>
          </div>)}
        </div>
        <p style={{marginTop:16,fontSize:13,color:'var(--color-text-muted)'}}>{data.note}</p>
      </>}
    </section>
  );
}
