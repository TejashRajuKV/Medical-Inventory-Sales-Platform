import { useState, useEffect } from 'react';
import { sales } from '../api';
import './SalesHistory.css';

export default function SalesHistory() {
  const [list, setList] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [saleDetail, setSaleDetail] = useState(null);

  useEffect(() => { sales.list().then(setList); }, []);

  const expand = async (id) => {
    if (expanded === id) { setExpanded(null); setSaleDetail(null); return; }
    setExpanded(id);
    const detail = await sales.get(id);
    setSaleDetail(detail);
  };

  return (
    <div>
      <h1 className="page-title">Sales History</h1>
      <div className="med-table-wrap">
        <table className="med-table">
          <thead>
            <tr><th>Invoice</th><th>Customer</th><th>Items</th><th>Total</th><th>Billed By</th><th>Date</th><th></th></tr>
          </thead>
          <tbody>
            {list.map(s => (
              <>
                <tr key={s.id}>
                  <td className="inv-no">{s.invoice_no}</td>
                  <td>{s.customer_name || 'Walk-in'}</td>
                  <td></td>
                  <td className="med-price">₹{s.total_amount}</td>
                  <td>{s.billed_by_name}</td>
                  <td className="date-cell">{new Date(s.created_at).toLocaleDateString()}</td>
                  <td><button className="btn-sm" onClick={() => expand(s.id)}>{expanded === s.id ? 'Hide' : 'View'}</button></td>
                </tr>
                {expanded === s.id && saleDetail && (
                  <tr key={`${s.id}-detail`}>
                    <td colSpan="7" className="sale-detail-cell">
                      <div className="sale-detail">
                        <div className="sale-detail-items">
                          {saleDetail.items.map(it => (
                            <div key={it.id} className="sale-detail-line">
                              <div>
                                <span className="sale-detail-name">{it.medicine_name}</span>
                                <span className="sale-detail-batch">{it.batch_no} · exp {it.expiry_date}</span>
                              </div>
                              <div>
                                <span>{it.quantity} × ₹{it.price_at_sale}</span>
                                <span className="sale-detail-gst">+{it.gst_rate}%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="sale-detail-totals">
                          <div>Subtotal: ₹{saleDetail.subtotal}</div>
                          <div>GST: ₹{saleDetail.gst_amount}</div>
                          <div className="inv-total-line">Total: ₹{saleDetail.total_amount}</div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {list.length === 0 && <tr><td colSpan="7" className="empty-row">No sales yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
