import { useEffect, useState } from 'react';
import { medicines, purchaseOrders, suppliers } from '../api';

const emptyBatch = { medicine_id: '', batch_no: '', expiry_date: '', qty: '', cost_price: '' };

export default function PurchaseOrders() {
  const [orders, setOrders] = useState([]);
  const [supplierList, setSupplierList] = useState([]);
  const [medicineList, setMedicineList] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [batch, setBatch] = useState(emptyBatch);
  const [receivingId, setReceivingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    const [poRows, supplierRows, medicineRows] = await Promise.all([
      purchaseOrders.list(), suppliers.list(), medicines.list()
    ]);
    setOrders(poRows); setSupplierList(supplierRows); setMedicineList(medicineRows);
  };
  useEffect(() => { load().catch((e) => setError(e.message)); }, []);

  const createOrder = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      await purchaseOrders.create({ supplier_id: Number(supplierId) });
      setNotice('Purchase order created. Add received batches when the delivery arrives.');
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const cancelOrder = async (id) => {
    if (!confirm('Cancel this purchase order?')) return;
    setBusy(true); setError(''); setNotice('');
    try { await purchaseOrders.cancel(id); setNotice('Purchase order cancelled.'); await load(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const receiveOrder = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      await purchaseOrders.receive(receivingId, { batches: [{
        medicine_id: Number(batch.medicine_id), batch_no: batch.batch_no.trim(),
        expiry_date: batch.expiry_date, qty: Number(batch.qty), cost_price: Number(batch.cost_price)
      }] });
      setNotice('Delivery recorded and batch added to inventory.');
      setReceivingId(null); setBatch(emptyBatch); await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  return <section>
    <h1 className="page-title">Purchase Orders</h1>
    <p>Create supplier orders and record incoming batches with expiry and cost checks.</p>
    {error && <p role="alert" className="form-error">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <section className="dash-card" style={{margin:'20px 0'}}>
      <h2 className="dash-card-title">Create purchase order</h2>
      <form onSubmit={createOrder} style={{display:'flex',gap:12,flexWrap:'wrap'}}>
        <select className="form-input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required>
          <option value="">Choose supplier</option>
          {supplierList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button className="btn-primary" disabled={busy || !supplierId}>Create order</button>
      </form>
    </section>
    <div className="med-table-wrap">
      <table className="med-table">
        <thead><tr><th>Order</th><th>Supplier</th><th>Status</th><th>Ordered</th><th>Batches</th><th>Action</th></tr></thead>
        <tbody>
          {orders.map((order) => <tr key={order.id}>
            <td className="med-name">PO-{order.id}</td><td>{order.supplier_name || 'Unknown supplier'}</td>
            <td>{order.status}</td><td>{order.ordered_at}</td><td>{order.batch_count}</td>
            <td>{order.status === 'ordered' ? <div style={{display:'flex',gap:6}}><button className="btn-sm" onClick={() => { setReceivingId(order.id); setError(''); setNotice(''); }}>Receive delivery</button><button className="btn-sm btn-sm-danger" disabled={busy} onClick={() => cancelOrder(order.id)}>Cancel</button></div> : '—'}</td>
          </tr>)}
          {orders.length === 0 && <tr><td colSpan="6">No purchase orders yet.</td></tr>}
        </tbody>
      </table>
    </div>
    {receivingId !== null && <div className="form-overlay" onClick={(e) => e.target === e.currentTarget && setReceivingId(null)}>
      <div className="form-card">
        <h2>Receive PO-{receivingId}</h2>
        <p>Enter the details for one received batch. A purchase order is marked received after this batch is recorded.</p>
        <form onSubmit={receiveOrder}>
          <div className="form-grid">
            <label className="form-label">Medicine *
              <select className="form-input" value={batch.medicine_id} onChange={(e) => setBatch({...batch, medicine_id:e.target.value})} required>
                <option value="">Choose medicine</option>{medicineList.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
            <label className="form-label">Batch number *<input className="form-input" value={batch.batch_no} onChange={(e) => setBatch({...batch,batch_no:e.target.value})} required maxLength={100}/></label>
            <label className="form-label">Expiry date *<input className="form-input" type="date" min={new Date().toISOString().slice(0,10)} value={batch.expiry_date} onChange={(e) => setBatch({...batch,expiry_date:e.target.value})} required/></label>
            <label className="form-label">Quantity *<input className="form-input" type="number" min="1" step="1" value={batch.qty} onChange={(e) => setBatch({...batch,qty:e.target.value})} required/></label>
            <label className="form-label">Unit cost *<input className="form-input" type="number" min="0" step="0.01" value={batch.cost_price} onChange={(e) => setBatch({...batch,cost_price:e.target.value})} required/></label>
          </div>
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setReceivingId(null)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Record delivery'}</button>
          </div>
        </form>
      </div>
    </div>}
  </section>;
}
