import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoginModal from '../components/LoginModal';
import ScanModal from '../components/ScanModal';
import './LandingPage.css';

export default function LandingPage() {
  const nav = useNavigate();
  const [ref, setRef] = useState('');
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const updateViewport = () => {
      setIsDesktop(window.innerWidth > 768);
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);

    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  const search = (e) => {
    e.preventDefault();
    const value = String(ref).trim();

    if (!/^\d+$/.test(value)) {
      setError('Enter a valid document reference number.');
      setWarning(isDesktop ? 'Invalid input. Please enter numbers only.' : '');
      return;
    }

    setError('');
    setWarning('');
    nav(`/document/${value}`);
  };

  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className="landing-brand">
          <img src="/logo-dashboard.png" alt="Paper Tracking System" className="landing-logo" />
          <div>
            <div className="landing-brand-name">Paper Tracking System</div>
            <div className="landing-brand-sub">Municipality of Calape</div>
          </div>
        </div>

        <button type="button" className="btn btn-navy landing-login-btn" onClick={() => setShowLogin(true)}>
          Log In
        </button>
      </header>

      <main className="landing-main">
        <div className="landing-copy">
          <span className="landing-eyebrow">Document search portal</span>
          <h1>Search by Document</h1>
          <p>Enter the document reference number to open its full public details. Sign in only when you need to manage or update records.</p>
        </div>

        <form className="search-panel" onSubmit={search}>
          <label className="sr-only" htmlFor="document-ref">Search document reference</label>
          <div className="search-shell">
            <span className="search-icon" aria-hidden="true">⌕</span>
            <input
              id="document-ref"
              className="search-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              enterKeyHint="search"
              value={ref}
              onChange={e => {
                const value = e.target.value;
                setRef(isDesktop ? value : value.replace(/[^\d]/g, ''));
                if (isDesktop && /[^\d\s]/.test(value)) {
                  setWarning('Invalid input. Kindly use numbers only.');
                } else {
                  setWarning('');
                }
                if (error) {
                  setError('');
                }
              }}
              placeholder="Search by document reference number"
            />
            <button type="submit" className="btn btn-navy search-btn">Search</button>
          </div>
          {error && <div className="search-error">{error}</div>}
          {warning && !error && <div className="search-warning">{warning}</div>}
        </form>

        <div style={{ textAlign: 'center', marginTop: 28, marginBottom: 16 }}>
          <p style={{ fontSize: '12px', color: '#afb3c0', marginBottom: 12, fontWeight: 500 }}>OR</p>
          <button type="button" className="btn btn-navy" onClick={() => setShowQR(true)} style={{ padding: '12px 28px', fontSize: '16px', fontWeight: 600, minHeight: 48 }}>
            Scan Document QR Code
          </button>
          <p style={{ fontSize: '12px', color: '#9aa0b8', marginTop: 10 }}>Point your camera at a document QR code to view its details instantly</p>
        </div>
      </main>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
      {showQR && <ScanModal onClose={() => setShowQR(false)} />}
    </div>
  );
}