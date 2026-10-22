import { useEffect, useState } from 'react';
import { auditLogs } from '../api';
import { useAuth } from '../contexts/AuthContext';

export default function AuditLogs() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => {
    if (user?.role !== 'owner') return;
    auditLogs.list(100).then(setRows).catch((e) => setError(e.message));
  }, [user]);
  if (user?.role !== 'owner') return <section><h1 className="page-title">Audit History</h1><p>You need owner permissions to view this page.</p></section>;
  return <section>
    <h1 className="page-title">Audit History</h1>
    <p>Recent inventory and workflow actions recorded by the application.</p>
    {error && <p role="alert" className="form-error">{error}</p>}
    <div className="med-table-wrap"><table className="med-table">
      <thead><tr><th>When</th><th>User</th><th>Action</th><th>Entity</th><th>Reference</th><th>Details</th></tr></thead>
      <tbody>{rows.map((row) => <tr key={row.id}>
        <td>{row.created_at}</td><td>{row.user_name || 'System'}</td><td>{row.action}</td>
        <td>{row.entity_type}</td><td>{row.entity_id || '—'}</td><td style={{maxWidth:360,overflowWrap:'anywhere'}}>{row.details || '—'}</td>
      </tr>)}{rows.length === 0 && <tr><td colSpan="6">No audit events recorded yet.</td></tr>}</tbody>
    </table></div>
  </section>;
}
