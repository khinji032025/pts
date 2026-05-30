import React from 'react';
import { useNavigate } from 'react-router-dom';
import LoginForm from './LoginForm';

export default function LoginModal({ onClose }) {
  const nav = useNavigate();

  const handleSuccess = (user) => {
    onClose();
    nav(user.role === 'admin' ? '/admin' : '/dept');
  };

  return (
    <div className="overlay landing-login-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal landing-login-modal">
        <div className="modal-head">
          <span className="modal-title">🔐 Login</span>
          <button className="btn btn-outline btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <LoginForm compact onSuccess={handleSuccess} />
        </div>
      </div>
    </div>
  );
}