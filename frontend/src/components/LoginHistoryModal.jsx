import React, { useEffect, useState } from 'react';
import { authAPI } from '../utils/api';

export default function LoginHistoryModal({ onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const r = await authAPI.loginHistory();
        if (active) setLogs(r.data.logs || []);
      } catch (err) {
        if (active) setError(err.response?.data?.error || 'Failed to load login history.');
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => { active = false; };
  }, []);

  const formatDate = (value) => {
    const date = new Date(value);
    return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: '2-digit' });
  };

  const formatTime = (value) => {
    const date = new Date(value);
    return date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal login-history-modal">
        <div className="modal-head">
          <span className="modal-title">📜 Log History</span>
          <button className="login-history-close" type="button" aria-label="Close log history" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body login-history-body">
          {error && <div className="alert a-err">{error}</div>}

          {loading ? (
            <div style={{ padding: 28, textAlign: 'center' }}>
              <div className="spinner" style={{ margin: '0 auto' }} />
            </div>
          ) : logs.length === 0 ? (
            <div className="center muted" style={{ padding: '14px 0' }}>No department login history yet.</div>
          ) : (
            <>
              <div className="login-history-desktop tbl-wrap">
                <table className="login-history-table">
                  <thead>
                    <tr>
                      <th>Who</th>
                      <th>Department</th>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Method</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => (
                      <tr key={log.id}>
                        <td style={{ fontWeight: 600 }}>{log.username}</td>
                        <td>{log.department_name || '—'}</td>
                        <td>{formatDate(log.login_at)}</td>
                        <td>{formatTime(log.login_at)}</td>
                        <td><span className="badge b-none" style={{ textTransform: 'capitalize' }}>{log.login_method}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="login-history-mobile">
                {logs.map(log => (
                  <div key={log.id} className="login-history-item">
                    <div className="login-history-line"><span>Who</span><strong>{log.username}</strong></div>
                    <div className="login-history-line"><span>Department</span><strong>{log.department_name || '—'}</strong></div>
                    <div className="login-history-line"><span>Date</span><strong>{formatDate(log.login_at)}</strong></div>
                    <div className="login-history-line"><span>Time</span><strong>{formatTime(log.login_at)}</strong></div>
                    <div className="login-history-line"><span>Method</span><strong style={{ textTransform: 'capitalize' }}>{log.login_method}</strong></div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="modal-foot">
          <button className="btn btn-outline" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}