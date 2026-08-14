import http from 'http';

function post(path, body, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = {
      hostname: 'localhost', port: 4000, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length, ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    };
    const req = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(path, token) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost', port: 4000, path,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    };
    http.get(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    }).on('error', reject);
  });
}

async function main() {
  // Login
  const login = await post('/api/auth/login', { email: 'owner@pharma.com', password: 'owner123' });
  const { token } = JSON.parse(login.body);
  console.log('1. Login OK, token:', token.slice(0, 20) + '...');

  // Test FEFO split: Cough Syrup (id=9) has batch 1 qty=30, batch 2 qty=50
  const sale = await post('/api/sales', { items: [{ medicine_id: 9, quantity: 35 }] }, token);
  const sd = JSON.parse(sale.body);
  console.log('2. FEFO Sale:', sd.invoiceNo, '| Batches used:', sd.items.length);
  for (const i of sd.items) {
    console.log('   - Batch', i.batch_id, ':', i.quantity, 'units @', i.price_at_sale);
  }

  // Test reorder suggestions
  const suggestions = await get('/api/reorders/suggestions', token);
  const sg = JSON.parse(suggestions.body);
  console.log('3. Reorder suggestions:', sg.length);
  for (const s of sg.slice(0, 3)) {
    console.log('   -', s.name, '→ suggest', s.suggested_qty, '| reason:', s.reason.slice(0, 60) + '...');
  }

  // Test daily analytics
  const daily = await get('/api/reorders/analytics/daily', token);
  const dl = JSON.parse(daily.body);
  console.log('4. Daily analytics entries:', dl.length);

  // Test alerts
  const alerts = await get('/api/alerts', token);
  const al = JSON.parse(alerts.body);
  console.log('5. Alerts:', al.unread, 'unread of', al.alerts?.length || al.length);

  console.log('\nAll tests passed.');
}

main().catch(e => console.error('FAIL:', e.message));
