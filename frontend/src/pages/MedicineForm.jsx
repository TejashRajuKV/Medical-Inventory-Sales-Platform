import { useState, useEffect } from 'react';
import { medicines } from '../api';
import './MedicineForm.css';

const EMPTY = {
  name: '', brand: '', salt_composition: '', category: '',
  is_prescription_required: false, cost_price: '', price: '',
  gst_rate: 5, low_stock_threshold: 10, barcode: '', supplier_id: ''
};

export default function MedicineForm({ medicine, onSave, onCancel }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const isEdit = !!medicine;

  useEffect(() => {
    if (medicine) {
      setForm({
        name: medicine.name,
        brand: medicine.brand || '',
        salt_composition: medicine.salt_composition || '',
        category: medicine.category || '',
        is_prescription_required: !!medicine.is_prescription_required,
        cost_price: medicine.cost_price || '',
        price: medicine.price,
        gst_rate: medicine.gst_rate,
        low_stock_threshold: medicine.low_stock_threshold,
        barcode: medicine.barcode || '',
        supplier_id: medicine.supplier_id || '',
      });
    }
  }, [medicine]);

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        ...form,
        cost_price: form.cost_price ? Number(form.cost_price) : null,
        price: Number(form.price),
        gst_rate: Number(form.gst_rate),
        low_stock_threshold: Number(form.low_stock_threshold),
        supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
      };
      if (isEdit) {
        await medicines.update(medicine.id, payload);
      } else {
        await medicines.create(payload);
      }
      onSave();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="form-overlay">
      <div className="form-card">
        <h2>{isEdit ? 'Edit Medicine' : 'Add Medicine'}</h2>
        {error && <div className="form-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <label className="form-label">Name *<input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} required /></label>
            <label className="form-label">Brand<input className="form-input" value={form.brand} onChange={e => set('brand', e.target.value)} /></label>
            <label className="form-label">Salt Composition<input className="form-input" value={form.salt_composition} onChange={e => set('salt_composition', e.target.value)} /></label>
            <label className="form-label">Category<input className="form-input" value={form.category} onChange={e => set('category', e.target.value)} /></label>
            <label className="form-label">Cost Price (₹)<input className="form-input" type="number" step="0.01" value={form.cost_price} onChange={e => set('cost_price', e.target.value)} /></label>
            <label className="form-label">Selling Price (₹) *<input className="form-input" type="number" step="0.01" value={form.price} onChange={e => set('price', e.target.value)} required /></label>
            <label className="form-label">GST Rate (%)<select className="form-input" value={form.gst_rate} onChange={e => set('gst_rate', e.target.value)}><option value="0">0%</option><option value="5">5%</option><option value="12">12%</option><option value="18">18%</option></select></label>
            <label className="form-label">Low Stock Threshold<input className="form-input" type="number" value={form.low_stock_threshold} onChange={e => set('low_stock_threshold', e.target.value)} /></label>
            <label className="form-label">Barcode<input className="form-input" value={form.barcode} onChange={e => set('barcode', e.target.value)} /></label>
          </div>
          <label className="form-check">
            <input type="checkbox" checked={form.is_prescription_required} onChange={e => set('is_prescription_required', e.target.checked)} />
            Prescription required (Schedule H/H1)
          </label>
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : isEdit ? 'Update' : 'Add Medicine'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}