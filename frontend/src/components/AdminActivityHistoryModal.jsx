import React, { useEffect, useState } from 'react';
import { authAPI } from '../utils/api';

export default function AdminActivityHistoryModal({ onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const r = await authAPI.adminActivityHistory();
        if (active) setLogs(r.data.logs || []);
      } catch (err) {
        if (active) setError(err.response?.data?.error || 'Failed to load admin activity history.');
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
      <div className="modal admin-activity-history-modal">
        <div className="modal-head">
          <span className="modal-title">🧾 Admin Activity History</span>
          <button className="login-history-close" type="button" aria-label="Close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body login-history-body">
          {error && <div className="alert a-err">{error}</div>}

          {loading ? (
            <div style={{ padding: 28, textAlign: 'center' }}>
              <div className="spinner" style={{ margin: '0 auto' }} />
            </div>
          ) : logs.length === 0 ? (
            <div className="center muted" style={{ padding: '14px 0' }}>No admin activity history yet.</div>
          ) : (
            <>
              <div className="login-history-desktop tbl-wrap">
                <table className="login-history-table">
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Target</th>
                      <th>Details</th>
                      <th>Who</th>
                      <th>Date</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => (
                      <tr key={log.id}>
                        <td style={{ fontWeight: 600 }}>{log.action}</td>
                        <td>{log.target_type ? `${log.target_type}${log.target_id ? ` #${log.target_id}` : ''}` : '—'}</td>
                        <td>{log.details || '—'}</td>
                        <td>{log.username}</td>
                        <td>{formatDate(log.created_at)}</td>
                        <td>{formatTime(log.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="login-history-mobile">
                {logs.map(log => (
                  <div key={log.id} className="login-history-item">
                    <div className="login-history-line"><span>Action</span><strong>{log.action}</strong></div>
                    <div className="login-history-line"><span>Target</span><strong>{log.target_type ? `${log.target_type}${log.target_id ? ` #${log.target_id}` : ''}` : '—'}</strong></div>
                    <div className="login-history-line"><span>Details</span><strong>{log.details || '—'}</strong></div>
                    <div className="login-history-line"><span>Who</span><strong>{log.username}</strong></div>
                    <div className="login-history-line"><span>Date</span><strong>{formatDate(log.created_at)}</strong></div>
                    <div className="login-history-line"><span>Time</span><strong>{formatTime(log.created_at)}</strong></div>
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
