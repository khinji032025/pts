import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { paperAPI } from '../utils/api';
import StatusBadge from '../components/StatusBadge';

export default function PublicDocumentView() {
  const { ref } = useParams();
  const nav = useNavigate();
  const [paper, setPaper] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const r = await paperAPI.publicView(ref);
        setPaper(r.data.paper);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load document.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [ref]);

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  const backToSearch = () => nav('/login');

  return (
    <div className="page">
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 16 }}>
        <button className="btn btn-outline btn-sm" onClick={backToSearch} style={{ minHeight: 44, padding: '10px 14px' }}>← Back to Search</button>
      </div>
      {error && <div className="alert a-err">{error}</div>}
      {!error && paper && (
        <div className="g2">
          <div className="card">
            <div className="card-head"><span className="card-title">📄 Document Details</span></div>
            <div className="card-body">
              <div className="paper-detail-item" style={{ marginBottom: 14 }}>
                <div className="paper-detail-label">Ref Code</div>
                <div className="paper-detail-value"><span className="mono" style={{ fontSize: 22, fontWeight: 800, color: 'var(--navy)' }}>#{paper.ref_code}</span></div>
              </div>
              <div className="paper-detail-item" style={{ marginBottom: 14 }}>
                <div className="paper-detail-label">Title</div>
                <div className="paper-detail-value">{paper.title}</div>
              </div>
            </div>
          </div>

          <div className="card full-span">
            <div className="card-head"><span className="card-title">📋 Status History</span></div>
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Action</th>
                    <th>Department</th>
                    <th>User</th>
                    <th>Person</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {paper.logs?.length > 0 ? paper.logs.map(log => (
                    <tr key={log.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{new Date(log.created_at).toLocaleString('en-PH')}</td>
                      <td><StatusBadge action={log.action} /></td>
                      <td>{log.dept_name}</td>
                      <td>{log.username}</td>
                      <td>{log.person || '—'}</td>
                      <td><span className="badge b-none">{log.note || 'manual'}</span></td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--t3)' }}>No status history yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

          

    </div>
  );
}