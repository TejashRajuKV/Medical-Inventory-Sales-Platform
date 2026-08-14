import { useState, useEffect } from 'react';
import { suppliers } from '../api';
import './Suppliers.css';

export default function Suppliers() {
  const [list, setList] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: '', contact_info: '' });
  const [saving, setSaving] = useState(false);

  const load = () => suppliers.list().then(setList);
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditItem(null); setForm({ name: '', contact_info: '' }); setShowForm(true); };
  const openEdit = (s) => { setEditItem(s); setForm({ name: s.name, contact_info: s.contact_info || '' }); setShowForm(true); };

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (editItem) await suppliers.update(editItem.id, form);
      else await suppliers.create(form);
      setShowForm(false); load();
    } catch (err) { alert(err.message); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this supplier?')) return;
    await suppliers.remove(id); load();
  };

  return (
    <div>
      <div className="med-header">
        <h1 className="page-title">Suppliers</h1>
        <button className="btn-primary" onClick={openNew}>+ Add Supplier</button>
      </div>

      <div className="med-table-wrap">
        <table className="med-table">
          <thead><tr><th>Name</th><th>Contact</th><th>Actions</th></tr></thead>
          <tbody>
            {list.map(s => (
              <tr key={s.id}>
                <td className="med-name">{s.name}</td>
                <td style={{fontSize:13,color:'var(--color-text-muted)'}}>{s.contact_info || '—'}</td>
                <td className="med-actions">
                  <button className="btn-sm" onClick={() => openEdit(s)}>Edit</button>
                  <button className="btn-sm btn-sm-danger" onClick={() => handleDelete(s.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="form-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="form-card">
            <h2>{editItem ? 'Edit' : 'Add'} Supplier</h2>
            <form onSubmit={handleSave}>
              <div className="form-grid">
                <label className="form-label">Name *<input className="form-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></label>
                <label className="form-label">Contact Info<input className="form-input" value={form.contact_info} onChange={e => setForm({...form, contact_info: e.target.value})} /></label>
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}