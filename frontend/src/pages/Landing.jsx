import { Link } from 'react-router-dom';
import ThreeScene from '../components/ThreeScene';
import { FeatureIcon3D } from '../components/FeatureIcons3D';
import './Landing.css';

export default function Landing() {
  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className="landing-logo">MedInvent AI</div>
        <nav className="landing-nav">
          <Link to="/login" className="btn btn-outline">Sign In</Link>
          <Link to="/login" className="btn btn-primary">Get Started</Link>
        </nav>
      </header>

      <main className="landing-main">
        <div className="landing-content">
          <h1 className="landing-title">Smart Pharmacy Management. <br/><span className="text-accent">Powered by AI.</span></h1>
          <p className="landing-subtitle">
            Say goodbye to expired stock and stockouts. Our intelligent platform predicts your demand, enforces FEFO billing, and automates reordering so you can focus on patient care.
          </p>
          <div className="landing-actions">
            <Link to="/login" className="btn btn-primary btn-lg">Launch Dashboard</Link>
            <a href="#features" className="btn btn-outline btn-lg">Learn More</a>
          </div>
          
          <div className="landing-stats">
            <div className="stat-item">
              <strong>98%</strong>
              <span>Accuracy</span>
            </div>
            <div className="stat-item">
              <strong>0%</strong>
              <span>Expired Stock</span>
            </div>
            <div className="stat-item">
              <strong>24/7</strong>
              <span>Monitoring</span>
            </div>
          </div>
        </div>

        <div className="landing-3d">
          <ThreeScene />
        </div>
      </main>

      <section id="features" className="features-section">
        <h2 className="section-title">Everything you need to run a modern pharmacy</h2>
        <div className="features-grid">
          <div className="feature-card">
            <FeatureIcon3D type="ai" />
            <h3>AI Demand Prediction</h3>
            <p>Our machine learning models analyze your past sales to predict what you'll need next month, preventing stockouts before they happen.</p>
          </div>
          <div className="feature-card">
            <FeatureIcon3D type="fefo" />
            <h3>FEFO Inventory</h3>
            <p>First Expiring, First Out. The system automatically deducts from the batch that expires soonest, ensuring zero dead stock.</p>
          </div>
          <div className="feature-card">
            <FeatureIcon3D type="auto" />
            <h3>Automated Reordering</h3>
            <p>Review AI-generated purchase suggestions and approve them with one click. We handle generating the purchase orders.</p>
          </div>
          <div className="feature-card">
            <FeatureIcon3D type="chart" />
            <h3>Smart Analytics</h3>
            <p>Get daily and weekly breakdowns of your revenue, units sold, and automatically identify dead stock eating up your capital.</p>
          </div>
        </div>
      </section>

      <section className="cta-section">
        <h2>Ready to modernize your pharmacy?</h2>
        <p>Join hundreds of pharmacies reducing waste and increasing profit margins.</p>
        <Link to="/login" className="btn btn-primary btn-lg mt-4">Start Your Free Trial</Link>
      </section>

      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-brand">MedInvent AI</div>
          <div className="footer-links">
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
            <a href="#">Contact Support</a>
          </div>
        </div>
        <div className="footer-copyright">
          &copy; {new Date().getFullYear()} MedInvent AI. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
