import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Sidebar.css';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '⊞' },
  { to: '/billing', label: 'Billing', icon: '₹' },
  { to: '/medicines', label: 'Medicines', icon: '●' },
  { to: '/suppliers', label: 'Suppliers', icon: '◆' },
  { to: '/reorders', label: 'Reorder AI', icon: '↗' },
  { to: '/sales-history', label: 'Sales History', icon: '≡' },
  { to: '/alerts', label: 'Alerts', icon: '!' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-logo">P</span>
        <span className="sidebar-title">PharmaStock</span>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <span className="sidebar-icon">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{user?.name?.[0] || 'U'}</div>
          <div>
            <div className="sidebar-username">{user?.name}</div>
            <div className="sidebar-role">{user?.role}</div>
          </div>
        </div>
        <button className="sidebar-logout" onClick={logout}>Sign out</button>
      </div>
    </aside>
  );
}