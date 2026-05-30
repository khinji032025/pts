import React, { useState } from 'react';
import { authAPI } from '../utils/api';

export default function ChangePasswordModal({ onClose }) {
  const [form, setForm] = useState({ current: '', new: '', confirm: '' });
  const [error, setError]   = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy]     = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (form.new !== form.confirm) { setError('New passwords do not match.'); return; }
    if (form.new.length < 6) { setError('New password must be at least 6 characters.'); return; }
    setBusy(true);
    try {
      await authAPI.changePassword({ current: form.current, new: form.new });
      setSuccess('Password changed!');
      setTimeout(onClose, 1400);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed.');
    } finally { setBusy(false); }
  };

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <span className="modal-title">🔑 Change Password</span>
          <button className="btn btn-outline btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {error   && <div className="alert a-err">{error}</div>}
            {success && <div className="alert a-ok">{success}</div>}
            <div className="fg"><label className="lbl">Current Password</label>
              <input className="inp" type="password" required value={form.current} onChange={e => setForm(f=>({...f,current:e.target.value}))} /></div>
            <div className="fg"><label className="lbl">New Password</label>
              <input className="inp" type="password" required minLength={6} value={form.new} onChange={e => setForm(f=>({...f,new:e.target.value}))} /></div>
            <div className="fg"><label className="lbl">Confirm New Password</label>
              <input className="inp" type="password" required value={form.confirm} onChange={e => setForm(f=>({...f,confirm:e.target.value}))} /></div>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-navy" disabled={busy}>{busy ? 'Saving…' : 'Update'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
