import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginForm({ compact = false, onSuccess }) {
  const { login } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  const handleSuccess = (user) => {
    if (onSuccess) {
      onSuccess(user);
      return;
    }
    nav(user.role === 'admin' ? '/admin' : '/dept');
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await login(form.username, form.password);
      handleSuccess(user);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <form onSubmit={submit} className={compact ? 'login-form-compact' : ''}>
        {error && <div className="alert a-err">{error}</div>}

        <div className="fg">
          <label className="lbl">Username</label>
          <input className="inp" type="text" autoComplete="username" required value={form.username} placeholder="Enter username" onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
        </div>

        <div className="fg">
          <label className="lbl">Password</label>
          <div style={{ position: 'relative' }}>
            <input className="inp" type={show ? 'text' : 'password'} autoComplete="current-password" required value={form.password} placeholder="Enter password" style={{ paddingRight: 40 }} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            <button type="button" onClick={() => setShow(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, opacity: .6 }}>
              {show ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.77 21.77 0 0 1 4.11-5.17" />
                  <path d="M1 1l22 22" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <button type="submit" className="btn btn-navy btn-lg btn-full" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign In'}
        </button>
        <p className="login-hint">ADMIN and DEPARTMENT accounts sign in here.</p>
      </form>
    </>
  );
}