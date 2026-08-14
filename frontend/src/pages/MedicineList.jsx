import { useState, useEffect } from 'react';
import { medicines } from '../api';
import FreshnessDot from '../components/FreshnessDot';
import MedicineForm from './MedicineForm';
import './MedicineList.css';

export default function MedicineList() {
  const [list, setList] = useState([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editMed, setEditMed] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const load = async () => {
    const data = await medicines.list(search);
    setList(data);
  };

  useEffect(() => { load(); }, [search]);

  const handleSave = async () => {
    setShowForm(false);
    setEditMed(null);
    await load();
  };

  const handleEdit = (med) => {
    setEditMed(med);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this medicine?')) return;
    await medicines.remove(id);
    await load();
  };

  const toggleBatches = async (id) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
  };

  return (
    <div>
      <div className="med-header">
        <h1 className="page-title">Medicines</h1>
        <button className="btn-primary" onClick={() => { setEditMed(null); setShowForm(true); }}>
          + Add Medicine
        </button>
      </div>

      <div className="med-search">
        <input
          className="med-search-input"
          placeholder="Search by name, brand, or salt composition..."
          value={search} onChange={e => setSearch(e.target.value)}
        />
      </div>

      {showForm && (
        <MedicineForm medicine={editMed} onSave={handleSave} onCancel={() => { setShowForm(false); setEditMed(null); }} />
      )}

      <div className="med-table-wrap">
        <table className="med-table">
          <thead>
            <tr>
              <th>Medicine</th>
              <th>Category</th>
              <th>Stock</th>
              <th>Freshness</th>
              <th>Price</th>
              <th>GST</th>
              <th>Rx</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map(m => (
              <>
                <tr key={m.id}>
                  <td>
                    <div className="med-name">{m.name}</div>
                    <div className="med-brand">{m.brand}</div>
                  </td>
                  <td><span className="badge-cat">{m.category}</span></td>
                  <td>
                    <span className={m.total_stock <= m.low_stock_threshold ? 'stock-low' : 'stock-ok'}>
                      {m.total_stock}
                    </span>
                  </td>
                  <td><FreshnessDot expiryDate={m.nearest_expiry} /></td>
                  <td className="med-price">₹{m.price}</td>
                  <td>{m.gst_rate}%</td>
                  <td>{m.is_prescription_required ? 'Yes' : 'No'}</td>
                  <td className="med-actions">
                    <button className="btn-sm" onClick={() => handleEdit(m)}>Edit</button>
                    <button className="btn-sm btn-sm-danger" onClick={() => handleDelete(m.id)}>Delete</button>
                    <button className="btn-sm btn-sm-ghost" onClick={() => toggleBatches(m.id)}>
                      {expandedId === m.id ? 'Hide' : 'Batches'}
                    </button>
                  </td>
                </tr>
                {expandedId === m.id && (
                  <tr key={`${m.id}-batches`}>
                    <td colSpan="8" className="batch-row">
                      <BatchExpand medicineId={m.id} />
                    </td>
                  </tr>
                )}
              </>
            ))}
            {list.length === 0 && (
              <tr><td colSpan="8" className="empty-row">No medicines found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BatchExpand({ medicineId }) {
  const [batches, setBatches] = useState([]);

  useEffect(() => {
    medicines.batches(medicineId).then(setBatches);
  }, [medicineId]);

  if (!batches.length) return <p className="batch-empty">No batches.</p>;

  return (
    <div className="batch-table-wrap">
      <table className="batch-table">
        <thead>
          <tr><th>Batch No</th><th>Expiry</th><th>Qty</th><th>Cost</th></tr>
        </thead>
        <tbody>
          {batches.map(b => (
            <tr key={b.id}>
              <td>{b.batch_no}</td>
              <td><FreshnessDot expiryDate={b.expiry_date} /></td>
              <td>{b.qty}</td>
              <td>₹{b.cost_price}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}