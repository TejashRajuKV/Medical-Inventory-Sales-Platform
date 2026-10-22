import { useEffect, useState } from 'react';
import { returnsApi, sales } from '../api';
import { useAuth } from '../contexts/AuthContext';

export default function Returns() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [salesRows, setSalesRows] = useState([]);
  const [saleId, setSaleId] = useState('');
  const [saleDetail, setSaleDetail] = useState(null);
  const [reason, setReason] = useState('');
  const [quantities, setQuantities] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    const [returnRows, saleList] = await Promise.all([returnsApi.list(), sales.list()]);
    setRows(returnRows); setSalesRows(saleList);
  };
  useEffect(() => { load().catch((e) => setError(e.message)); }, []);

  const chooseSale = async (value) => {
    setSaleId(value); setSaleDetail(null); setQuantities({}); setError('');
    if (!value) return;
    try { setSaleDetail(await sales.get(value)); }
    catch (e) { setError(e.message); }
  };

  const submitReturn = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    const items = Object.entries(quantities).map(([sale_item_id, quantity]) => ({
      sale_item_id: Number(sale_item_id), quantity: Number(quantity)
    })).filter((item) => Number.isSafeInteger(item.quantity) && item.quantity > 0);
    if (!items.length) { setBusy(false); setError('Enter at least one positive return quantity.'); return; }
    try {
      const result = await returnsApi.create({ sale_id: Number(saleId), reason: reason.trim(), items });
      setNotice('Return request #' + result.id + ' submitted for owner review. Estimated refund: ₹' + Number(result.refund_amount).toFixed(2));
      setSaleId(''); setSaleDetail(null); setReason(''); setQuantities({}); await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const review = async (id, decision) => {
    const restock = decision === 'approve' && confirm('Restock these items only if they are unopened, inspected and safe to resell. Approve restocking to the original batches?');
    if (decision === 'approve' && !confirm('Approve the recorded refund? Choose OK to continue; restocking is a separate safety decision.')) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await returnsApi.review(id, decision, restock);
      setNotice('Return request #' + id + ' ' + (decision === 'approve' ? 'approved' : 'rejected') + '.');
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  return <section>
    <h1 className="page-title">Returns & Refunds</h1>
    <p>Record returns against original invoices. Refund approval does not automatically restock medicine.</p>
    {error && <p role="alert" className="form-error">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <section className="dash-card" style={{margin:'20px 0'}}>
      <h2 className="dash-card-title">Request a return</h2>
      <form onSubmit={submitReturn}>
        <div className="form-grid">
          <label className="form-label">Original invoice *
            <select className="form-input" value={saleId} onChange={(e) => chooseSale(e.target.value)} required>
              <option value="">Choose invoice</option>
              {salesRows.map((sale) => <option key={sale.id} value={sale.id}>{sale.invoice_no} · {sale.created_at} · ₹{sale.total_amount}</option>)}
            </select>
          </label>
          <label className="form-label">Reason *
            <input className="form-input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} required/>
          </label>
        </div>
        {saleDetail && <div className="med-table-wrap" style={{marginTop:16}}>
          <table className="med-table"><thead><tr><th>Medicine</th><th>Batch</th><th>Sold</th><th>Return quantity</th></tr></thead>
            <tbody>{saleDetail.items.map((item) => <tr key={item.id}>
              <td>{item.medicine_name}</td><td>{item.batch_no}</td><td>{item.quantity}</td>
              <td><input aria-label={'Return quantity for ' + item.medicine_name} type="number" min="0" max={item.quantity} step="1" value={quantities[item.id] ?? 0}
                onChange={(e) => setQuantities({...quantities, [item.id]: e.target.value})} style={{width:90}}/></td>
            </tr>)}</tbody>
          </table>
        </div>}
        <div className="form-actions"><button className="btn-primary" disabled={busy || !saleDetail}>{busy ? 'Saving…' : 'Submit return request'}</button></div>
      </form>
    </section>
    <h2>Return history</h2>
    <div className="med-table-wrap"><table className="med-table">
      <thead><tr><th>Request</th><th>Invoice</th><th>Reason</th><th>Refund</th><th>Status</th><th>Requested</th>{user?.role === 'owner' && <th>Review</th>}</tr></thead>
      <tbody>{rows.map((row) => <tr key={row.id}>
        <td>RET-{row.id}</td><td>{row.invoice_no}</td><td>{row.reason}</td><td>₹{Number(row.refund_amount).toFixed(2)}</td><td>{row.status}</td><td>{row.created_at}</td>
        {user?.role === 'owner' && <td>{row.status === 'pending' ? <div style={{display:'flex',gap:6}}>
          <button className="btn-sm" disabled={busy} onClick={() => review(row.id, 'approve')}>Approve</button>
          <button className="btn-sm btn-sm-danger" disabled={busy} onClick={() => review(row.id, 'reject')}>Reject</button>
        </div> : '—'}</td>}
      </tr>)}
      {rows.length === 0 && <tr><td colSpan={user?.role === 'owner' ? 7 : 6}>No return requests yet.</td></tr>}</tbody>
    </table></div>
  </section>;
}
