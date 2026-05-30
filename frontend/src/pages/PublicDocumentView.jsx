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
  const [previewImage, setPreviewImage] = useState(null);

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
        <span style={{ fontSize: 12, color: 'var(--t2)' }}>Reference # {paper?.ref_code || ref}</span>
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
              <div className="paper-detail-item" style={{ marginBottom: 14 }}>
                <div className="paper-detail-label">Origin</div>
                <div className="paper-detail-value">{paper.origin}</div>
              </div>
              <div className="paper-detail-item" style={{ marginBottom: 14 }}>
                <div className="paper-detail-label">Status</div>
                <div className="paper-detail-value"><StatusBadge action={paper.status_action} dept={paper.status_dept} /></div>
              </div>
              <div className="paper-detail-item" style={{ marginBottom: 14 }}>
                <div className="paper-detail-label">Current Location</div>
                <div className="paper-detail-value">{paper.current_location || '—'}</div>
              </div>
              <div className="paper-detail-item" style={{ marginBottom: 14 }}>
                <div className="paper-detail-label">Last Scan</div>
                <div className="paper-detail-value">
                  {paper.last_scanned_at ? new Date(paper.last_scanned_at).toLocaleString('en-PH') : '—'}
                </div>
              </div>
              <div className="paper-detail-item">
                <div className="paper-detail-label">Created</div>
                <div className="paper-detail-value">{new Date(paper.created_at).toLocaleString('en-PH')}</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><span className="card-title">🖼️ Attached Images</span></div>
            <div className="card-body">
              {paper.images?.length > 0 ? (
                <div className="row">
                  {paper.images.map(img => (
                    <div key={img.id} style={{ display: 'block', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
                      <button type="button" onClick={() => setPreviewImage(img)} style={{ border: 0, padding: 0, background: 'transparent' }}>
                        <img src={`/pts/${img.image_path}`} alt="document" style={{ width: 220, height: 160, objectFit: 'cover', display: 'block' }} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: 'var(--t3)' }}>No image attached.</div>
              )}
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
                    <th>Note</th>
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

        {previewImage && (
          <div className="overlay" onClick={e => e.target === e.currentTarget && setPreviewImage(null)}>
            <div className="modal" style={{ maxWidth: '100%', padding: 0 }}>
              <div className="modal-head">
                <span className="modal-title">🖼️ View Image</span>
                <button className="btn btn-outline btn-sm" onClick={() => setPreviewImage(null)}>✕</button>
              </div>
              <div className="modal-body" style={{ textAlign: 'center', padding: 0 }}>
                <img
                  src={`/pts/${previewImage.image_path}`}
                  alt="document preview"
                  style={{ width: '100%', maxHeight: '90vh', objectFit: 'contain', display: 'block' }}
                />
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--t3)' }}>
                  Uploaded on {new Date(previewImage.uploaded_at).toLocaleString('en-PH')}
                </div>
              </div>
              <div className="modal-foot">
                <button className="btn btn-outline" onClick={() => setPreviewImage(null)}>Close</button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}