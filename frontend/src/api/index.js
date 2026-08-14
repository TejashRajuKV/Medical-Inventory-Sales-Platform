const BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(url, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${url}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const auth = {
  login: (email, password) => request('/auth/login', {
    method: 'POST', body: JSON.stringify({ email, password })
  }),
};

export const users = {
  list: () => request('/users'),
  create: (data) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
  remove: (id) => request(`/users/${id}`, { method: 'DELETE' }),
};

export const medicines = {
  list: (search) => request(`/medicines${search ? '?search=' + encodeURIComponent(search) : ''}`),
  get: (id) => request(`/medicines/${id}`),
  create: (data) => request('/medicines', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/medicines/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => request(`/medicines/${id}`, { method: 'DELETE' }),
  batches: (id) => request(`/medicines/${id}/batches`),
};

export const sales = {
  create: (data) => request('/sales', { method: 'POST', body: JSON.stringify(data) }),
  list: () => request('/sales'),
  get: (id) => request(`/sales/${id}`),
  deadStock: () => request('/sales/analytics/dead-stock'),
};

export const customers = {
  list: (search) => request(`/customers${search ? '?search=' + encodeURIComponent(search) : ''}`),
  create: (data) => request('/customers', { method: 'POST', body: JSON.stringify(data) }),
};

export const stockAdjustments = {
  list: () => request('/stock-adjustments'),
  create: (data) => request('/stock-adjustments', { method: 'POST', body: JSON.stringify(data) }),
};

export const alerts = {
  list: () => request('/alerts'),
  markRead: (id) => request(`/alerts/mark-read/${id}`, { method: 'POST' }),
  markAllRead: () => request('/alerts/mark-all-read', { method: 'POST' }),
};

export const suppliers = {
  list: () => request('/suppliers'),
  create: (data) => request('/suppliers', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => request(`/suppliers/${id}`, { method: 'DELETE' }),
};

export const purchaseOrders = {
  list: (status) => request(`/purchase-orders${status ? '?status=' + status : ''}`),
  create: (data) => request('/purchase-orders', { method: 'POST', body: JSON.stringify(data) }),
  receive: (id, data) => request(`/purchase-orders/${id}/receive`, { method: 'POST', body: JSON.stringify(data) }),
};

export const reorders = {
  list: () => request('/reorders'),
  suggestions: () => request('/reorders/suggestions'),
  create: (data) => request('/reorders', { method: 'POST', body: JSON.stringify(data) }),
  approve: (id) => request(`/reorders/${id}/approve`, { method: 'POST' }),
  reject: (id) => request(`/reorders/${id}/reject`, { method: 'POST' }),
  dailyAnalytics: (days) => request(`/reorders/analytics/daily?days=${days || 7}`),
  weeklyAnalytics: () => request('/reorders/analytics/weekly'),
};
