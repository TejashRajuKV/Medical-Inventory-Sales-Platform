import { useState, useEffect } from 'react';
import { alerts as alertsApi } from '../api';

export default function Alerts() {
  const [data, setData] = useState({ alerts: [], unread: 0 });

  const load = async () => {
    const res = await alertsApi.list();
    setData(Array.isArray(res) ? { alerts: res, unread: res.filter(a => !a.is_read).length } : res);
  };

  useEffect(() => { load(); }, []);

  const markRead = async (id) => { await alertsApi.markRead(id); load(); };
  const markAll = async () => { await alertsApi.markAllRead(); load(); };

  const typeColor = (type) => {
    if (type === 'low_stock') return 'badge-amber';
    if (type === 'near_expiry') return 'badge-red';
    return 'badge-cat';
  };

  return (
    <div>
      <div className="med-header">
        <h1 className="page-title">Alerts {data.unread > 0 && <span className="badge badge-amber" style={{marginLeft: 8}}>{data.unread} new</span>}</h1>
        {data.unread > 0 && <button className="btn-secondary" onClick={markAll}>Mark all read</button>}
      </div>
      <div className="alerts-list">
        {data.alerts.map(a => (
          <div key={a.id} className={`alert-card ${!a.is_read ? 'alert-unread' : ''}`} onClick={() => !a.is_read && markRead(a.id)}>
            <div className="alert-left">
              <span className={`badge ${typeColor(a.type)}`}>{a.type?.replace('_', ' ')}</span>
              <div className="alert-msg">{a.message}</div>
              <div className="alert-meta">{a.medicine_name} · {new Date(a.sent_at).toLocaleString()}</div>
            </div>
            {!a.is_read && <div className="alert-dot" />}
          </div>
        ))}
        {data.alerts.length === 0 && <p className="dash-empty">No alerts.</p>}
      </div>
    </div>
  );
}