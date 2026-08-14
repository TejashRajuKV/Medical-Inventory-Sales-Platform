import { useState, useEffect } from 'react';
import { medicines, sales, customers } from '../api';
import './Billing.css';

export default function Billing() {
  const [medList, setMedList] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [invoice, setInvoice] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { medicines.list().then(setMedList); }, []);

  const filtered = search
    ? medList.filter(m => m.name.toLowerCase().includes(search.toLowerCase()) || m.brand?.toLowerCase().includes(search.toLowerCase()))
    : medList;

  const addToCart = (med) => {
    if (med.total_stock <= 0) return;
    setCart(prev => {
      const existing = prev.find(c => c.medicine_id === med.id);
      if (existing) {
        if (existing.quantity >= med.total_stock) return prev;
        return prev.map(c => c.medicine_id === med.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { medicine_id: med.id, name: med.name, brand: med.brand, price: med.price, gst_rate: med.gst_rate, quantity: 1, maxStock: med.total_stock }];
    });
  };

  const updateQty = (id, qty) => {
    if (qty < 1) return removeFromCart(id);
    setCart(prev => prev.map(c => c.medicine_id === id ? { ...c, quantity: Math.min(qty, c.maxStock) } : c));
  };

  const removeFromCart = (id) => setCart(prev => prev.filter(c => c.medicine_id !== id));

  const subtotal = cart.reduce((s, c) => s + c.price * c.quantity, 0);
  const gstTotal = cart.reduce((s, c) => s + (c.price * c.quantity * c.gst_rate / 100), 0);
  const total = subtotal + gstTotal;

  const handleSale = async () => {
    setError('');
    setSaving(true);
    try {
      const result = await sales.create({
        customer_name: customerName || undefined,
        customer_phone: customerPhone || undefined,
        items: cart.map(c => ({ medicine_id: c.medicine_id, quantity: c.quantity }))
      });
      setInvoice(result);
      setCart([]);
      setSearch('');
      setCustomerName('');
      setCustomerPhone('');
      const updated = await medicines.list();
      setMedList(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="billing-layout">
      <div className="billing-left">
        <h1 className="page-title">Billing</h1>
        <input className="med-search-input" placeholder="Search medicines..." value={search} onChange={e => setSearch(e.target.value)} />
        <div className="med-picker">
          {filtered.map(m => (
            <button key={m.id} className={`med-pick-card ${m.total_stock <= 0 ? 'out-of-stock' : ''}`} onClick={() => addToCart(m)}>
              <div className="med-pick-name">{m.name}</div>
              <div className="med-pick-meta">{m.brand} · ₹{m.price}</div>
              <div className="med-pick-stock">Stock: {m.total_stock}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="billing-right">
        <div className="billing-customer">
          <input placeholder="Customer name (optional)" value={customerName} onChange={e => setCustomerName(e.target.value)} />
          <input placeholder="Phone (optional)" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
        </div>

        {error && <div className="form-error">{error}</div>}

        {invoice && (
          <div className="invoice-success">
            <div className="invoice-header">{invoice.invoiceNo}</div>
            <div className="invoice-items">
              {invoice.items.map((it, i) => (
                <div key={i} className="invoice-line">
                  <span>{it.name} x{it.quantity}</span>
                  <span>₹{it.lineTotal}</span>
                </div>
              ))}
            </div>
            <div className="invoice-totals">
              <div><span>Subtotal</span><span>₹{invoice.subtotal}</span></div>
              <div><span>GST</span><span>₹{invoice.totalGst}</span></div>
              <div className="invoice-total"><span>Total</span><span>₹{invoice.totalAmount}</span></div>
            </div>
            <button className="btn-secondary" onClick={() => setInvoice(null)} style={{marginTop: 12}}>New Sale</button>
          </div>
        )}

        {!invoice && (
          <>
            <div className="cart-section">
              <h3>Cart ({cart.length})</h3>
              {cart.length === 0 && <p className="cart-empty">Click medicines to add</p>}
              {cart.map(c => (
                <div key={c.medicine_id} className="cart-item">
                  <div className="cart-item-info">
                    <div className="cart-item-name">{c.name}</div>
                    <div className="cart-item-price">₹{c.price} × {c.gst_rate}% GST</div>
                  </div>
                  <div className="cart-item-qty">
                    <button onClick={() => updateQty(c.medicine_id, c.quantity - 1)}>-</button>
                    <span>{c.quantity}</span>
                    <button onClick={() => updateQty(c.medicine_id, c.quantity + 1)}>+</button>
                    <button className="cart-remove" onClick={() => removeFromCart(c.medicine_id)}>×</button>
                  </div>
                  <div className="cart-item-total">₹{Math.round((c.price * c.quantity * (1 + c.gst_rate / 100)) * 100) / 100}</div>
                </div>
              ))}
            </div>
            {cart.length > 0 && (
              <div className="cart-footer">
                <div className="cart-summary">
                  <div>Subtotal: ₹{subtotal.toFixed(2)}</div>
                  <div>GST: ₹{gstTotal.toFixed(2)}</div>
                  <div className="cart-grand-total">Total: ₹{total.toFixed(2)}</div>
                </div>
                <button className="btn-primary btn-bill" onClick={handleSale} disabled={saving}>
                  {saving ? 'Processing...' : `Bill ₹${total.toFixed(2)}`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}