import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './Login.css';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('owner@pharma.com');
  const [password, setPassword] = useState('owner123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">P</div>
          <h1>PharmaStock</h1>
          <p className="login-subtitle">Medical Inventory & Sales Platform</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="login-error">{error}</div>}

          <label className="login-label">
            Email
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="login-input" required
            />
          </label>

          <label className="login-label">
            Password
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="login-input" required
            />
          </label>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="login-hint">Demo: owner@pharma.com / owner123</p>
      </div>
    </div>
  );
}