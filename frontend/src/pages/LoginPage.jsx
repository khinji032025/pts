import React from 'react';
import LoginForm from '../components/LoginForm';
import './LoginPage.css';

export default function LoginPage() {
  return (
    <div className="login-bg">
      <div className="login-card">
        <div className="login-seal">
          <img src="/logo-dashboard.png" alt="Logo" style={{ width: 70, height: 70, borderRadius: '50%', objectFit: 'cover' }} />
        </div>
        <h1 className="login-title">PAPER TRACKING SYSTEM</h1>
        <p className="login-sub">Municipality of Calape</p>
        <div className="login-divider" />
        <LoginForm />
      </div>
    </div>
  );
}