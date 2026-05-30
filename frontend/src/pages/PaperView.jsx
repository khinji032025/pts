import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { paperAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import StatusBadge from '../components/StatusBadge';
import QRCode from '../components/QRCode';
import Barcode from '../components/Barcode';
import usePaperNotifications from '../hooks/usePaperNotifications';
import ErrorModal from '../components/ErrorModal';

export default function PaperView() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [paper, setPaper]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [editLog, setEditLog] = useState(null);
  const [msg, setMsg]         = useState('');
  const [error, setError]     = useState('');
  const [previewImage, setPreviewImage] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [apiError, setApiError] = useState(null);
  const fileRef = useRef();
  const { notifCount, recentPapers, markNotificationsSeen, markNotificationRead } = usePaperNotifications();

  const isAdmin = user?.role === 'admin';
  const currentStatus = paper?.status_action || null;
  const formatDateTime = (value) => value ? new Date(value).toLocaleString('en-PH') : '—';

  const canMarkIn = currentStatus !== 'IN' && currentStatus !== 'DONE';
  const canMarkOut = currentStatus === 'IN';
  const canMarkDone = !!currentStatus && currentStatus !== 'DONE';

  const detailRows = paper ? [
    ['Ref Code', <span className="mono" style={{ fontSize: 22, fontWeight: 800, color: 'var(--navy)' }}>#{paper.ref_code}</span>],
    ['Title', paper.title],
    ['Origin', paper.origin],
    ['Status', <StatusBadge action={paper.status_action} dept={paper.status_dept} />],
    ['Last Scan Time', formatDateTime(paper.last_scanned_at)],
    ['Last Scan Department', paper.status_dept || '—'],
    ['Created', <div><div>{new Date(paper.created_at).toLocaleDateString('en-PH', { year:'numeric', month:'long', day:'2-digit' })}</div><div style={{ fontSize:'12px', color:'var(--t3)', marginTop:'4px' }}>{new Date(paper.created_at).toLocaleTimeString('en-PH', { hour:'2-digit', minute:'2-digit', second:'2-digit' })}</div></div>],
  ] : [];

  const attemptMark = async (action) => {
    const allowed =
      (action === 'IN' && canMarkIn) ||
      (action === 'OUT' && canMarkOut) ||
      (action === 'DONE' && canMarkDone);

    if (!allowed) {
      const warning =
        action === 'IN' && currentStatus === 'IN' ? 'Duplicate IN. This paper is already marked IN.' :
        action === 'OUT' && !currentStatus ? 'Please mark IN first before marking OUT.' :
        action === 'OUT' && currentStatus === 'OUT' ? 'Duplicate OUT. This paper is already marked OUT.' :
        action === 'DONE' && !currentStatus ? 'Please mark IN first before marking DONE.' :
        action === 'DONE' && currentStatus === 'DONE' ? 'Duplicate DONE. This paper is already marked DONE.' :
        'This status update is not allowed right now.';
      setMsg(`⚠️ ${warning}`);
      setTimeout(() => setMsg(''), 3500);
      return;
    }
    await mark(action);
  };

  const load = async () => {
    try {
      const r = await paperAPI.view(id);
      setPaper(r.data.paper);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load paper.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const mark = async (action) => {
    try {
      await paperAPI.mark({ paper_id: parseInt(id), action, dept_id: user.dept_id, note: 'manual' });
      setMsg(`Marked ${action}.`);
      load();
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setMsg('Error: ' + (err.response?.data?.error || 'Failed'));
    }
  };

  const saveLog = async () => {
    try {
      await paperAPI.editLog(editLog.id, { action: editLog.action, note: editLog.note });
      setEditLog(null);
      load();
    } catch {}
  };

  const uploadImage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('paper_id', id);
    fd.append('image', file);
    try {
      await paperAPI.uploadImage(fd);
      load();
    } catch (err) {
      const status = err.response?.status;
      const backendMsg = err.response?.data?.error || 'Upload failed.';
      const msg = status === 403
        ? 'You do not have permission to upload images for this document. Only the document\'s origin department or an administrator may add files.'
        : backendMsg;
      setApiError({ title: status === 403 ? 'Action Not Allowed' : 'Upload Failed', message: msg });
    }
  };

  const viewImage = (img) => {
    setPreviewImage(img);
  };

  const deleteImage = async (img) => {
    setDeleteTarget(img);
  };

  const confirmDeleteImage = async () => {
    if (!deleteTarget) return;
    try {
      await paperAPI.deleteImage(deleteTarget.id);
      if (previewImage?.id === deleteTarget.id) setPreviewImage(null);
      setDeleteTarget(null);
      load();
    } catch (err) {
      const status = err.response?.status;
      const backendMsg = err.response?.data?.error || 'Delete failed.';
      const msg = status === 403
        ? 'You do not have permission to delete this file. Only the document\'s origin department or an administrator may remove uploaded files.'
        : backendMsg;
      setApiError({ title: status === 403 ? 'Action Not Allowed' : 'Delete Failed', message: msg });
    }
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  if (error) return (
    <div>
      <Navbar title="QR Office" notifCount={notifCount} recentPapers={recentPapers} onNotificationsClick={markNotificationsSeen} onNotificationRead={markNotificationRead} />
      <div className="page">
        <button className="btn btn-outline btn-sm mb4" onClick={() => nav(user?.role === 'admin' ? '/admin' : '/dept')}>← Back</button>
        <div className="alert a-err">{error}</div>
      </div>
    </div>
  );

  if (!paper) return null;

  return (
    <div>
      <Navbar title="QR Office" notifCount={notifCount} recentPapers={recentPapers} onNotificationsClick={markNotificationsSeen} />
      <div className="page">
        <button className="btn btn-outline btn-sm mb4" onClick={() => nav(-1)}>← Back</button>
        {msg && <div className="alert a-info mb4">{msg}</div>}

        <div className="g2 mb6">
          {/* Details */}
          <div className="card">
            <div className="card-head"><span className="card-title">📄 Document Details</span></div>
            <div className="card-body">
              <div className="paper-details-desktop">
                <table style={{ width: '100%' }}>
                  <tbody>
                    {detailRows.map(([k, v]) => (
                      <tr key={k} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '9px 0', fontWeight: 600, fontSize: 11, color: 'var(--t2)', width: 110, textTransform: 'uppercase', letterSpacing: '.4px' }}>{k}</td>
                        <td style={{ padding: '9px 0' }}>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="paper-details-mobile">
                {detailRows.map(([k, v]) => (
                  <div key={k} className="paper-detail-item">
                    <div className="paper-detail-label">{k}</div>
                    <div className="paper-detail-value">{v}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <div className="lbl" style={{ marginBottom: 10 }}>Quick Status Update</div>
                <div className="row">
                  {(isAdmin || user?.dept_name === paper.origin) ? (
                    <>
                      <button
                        className="btn btn-green"
                        onClick={() => attemptMark('IN')}
                        style={{ opacity: canMarkIn ? 1 : 0.45, cursor: canMarkIn ? 'pointer' : 'not-allowed' }}
                      >↓ Mark IN</button>
                      <button
                        className="btn btn-amber"
                        onClick={() => attemptMark('OUT')}
                        style={{ opacity: canMarkOut ? 1 : 0.45, cursor: canMarkOut ? 'pointer' : 'not-allowed' }}
                      >↑ Mark OUT</button>
                      <button
                        className="btn btn-navy"
                        onClick={() => attemptMark('DONE')}
                        style={{ opacity: canMarkDone ? 1 : 0.45, cursor: canMarkDone ? 'pointer' : 'not-allowed' }}
                      >✓ Mark Done</button>
                    </>
                  ) : (
                    <p className="sm muted">Only the origin department can update this paper's status.</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* QR + Barcode */}
          <div className="card">
            <div className="card-head"><span className="card-title">🔳 QR Code & Barcode</span></div>
            <div className="card-body" style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:24 }}>
  <div style={{ textAlign:'center' }}>
    <div className="lbl mb2">QR CODE</div>
    <QRCode value={paper.ref_code} size={180} />
    <div className="sm muted mt4">Scan to update status</div>
  </div>
  <div style={{ textAlign:'center' }}>
    <div className="lbl mb2">BARCODE</div>
    <Barcode value={paper.ref_code} width={2} height={60} />
  </div>
</div>
          </div>
        </div>

        {/* Document image */}
        <div className="card mb6">
          <div className="card-head">
            <span className="card-title">🖼️ Document Image</span>
            <button className="btn btn-gold btn-sm" onClick={() => fileRef.current?.click()}>📷 Upload Image</button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadImage} />
          </div>
          <div className="card-body">
            {paper.images?.length > 0 ? (
              <div className="row">
                {paper.images.map(img => (
                  <div key={img.id} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
                    <img src={`/pts/${img.image_path}`} alt="doc" style={{ width: 180, height: 140, objectFit: 'cover', display: 'block' }} />
                    <div style={{ padding: '8px 10px 10px' }}>
                      <div className="row" style={{ justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => viewImage(img)}>View</button>
                        <button type="button" className="btn btn-red btn-sm" onClick={() => deleteImage(img)}>✕</button>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--t3)' }}>{new Date(img.uploaded_at).toLocaleDateString('en-PH')}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="center" style={{ padding: '20px 0', color: 'var(--t3)' }}>
                No image yet.
                <br />
                <button className="btn btn-gold btn-sm" style={{ marginTop: 12 }} onClick={() => fileRef.current?.click()}>📷 Capture Document Image</button>
              </div>
            )}
          </div>
        </div>

        {/* Status History */}
        <div className="card full-span">
          <div className="card-head">
            <span className="card-title">📋 Status History</span>
            <span className="badge b-none">{paper.logs?.length || 0} entries</span>
          </div>
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
                  {isAdmin && <th>Edit</th>}
                </tr>
              </thead>
              <tbody>
                {paper.logs?.length > 0 ? paper.logs.map(log => (
                  <tr key={log.id}>
                    <td className="sm muted" style={{ whiteSpace: 'nowrap' }}>{new Date(log.created_at).toLocaleString('en-PH')}</td>
                    <td>
                      {editLog?.id === log.id
                        ? <select className="sel" style={{ width: 80 }} value={editLog.action} onChange={e => setEditLog(l => ({ ...l, action: e.target.value }))}>
                            <option>IN</option><option>OUT</option><option>DONE</option>
                          </select>
                        : <StatusBadge action={log.action} />}
                    </td>
                    <td>{log.dept_name}</td>
                    <td className="sm muted">{log.username}</td>
                    <td className="sm">{log.person || '—'}</td>
                    <td>
                      {editLog?.id === log.id
                        ? <input className="inp" style={{ width: 110 }} value={editLog.note} onChange={e => setEditLog(l => ({ ...l, note: e.target.value }))} />
                        : <span className="badge b-none">{log.note || 'manual'}</span>}
                    </td>
                    {isAdmin && (
                      <td>
                        {editLog?.id === log.id
                          ? <div className="row" style={{ gap: 4 }}>
                              <button className="btn btn-navy btn-sm" onClick={saveLog}>Save</button>
                              <button className="btn btn-outline btn-sm" onClick={() => setEditLog(null)}>Cancel</button>
                            </div>
                          : <button className="btn btn-outline btn-sm" onClick={() => setEditLog({ id: log.id, action: log.action, note: log.note || '' })}>Edit</button>}
                      </td>
                    )}
                  </tr>
                )) : (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--t3)' }}>No status history yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {previewImage && (
          <div className="overlay" onClick={e => e.target === e.currentTarget && setPreviewImage(null)}>
            <div className="modal" style={{ maxWidth: 900 }}>
              <div className="modal-head">
                <span className="modal-title">🖼️ View Document Image</span>
                <button className="btn btn-outline btn-sm" onClick={() => setPreviewImage(null)}>✕</button>
              </div>
              <div className="modal-body" style={{ textAlign: 'center' }}>
                <img
                  src={`/pts/${previewImage.image_path}`}
                  alt="document preview"
                  style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain', borderRadius: 8 }}
                />
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--t3)' }}>
                  Uploaded on {new Date(previewImage.uploaded_at).toLocaleString('en-PH')}
                </div>
              </div>
              <div className="modal-foot">
                <button className="btn btn-outline" onClick={() => setPreviewImage(null)}>Close</button>
              </div>
            </div>
          </div>
        )}

        {deleteTarget && (
          <div className="overlay" onClick={e => e.target === e.currentTarget && setDeleteTarget(null)}>
            <div className="modal" style={{ maxWidth: 460 }}>
              <div className="modal-head">
                <span className="modal-title">Delete Image</span>
                <button className="btn btn-outline btn-sm" onClick={() => setDeleteTarget(null)}>✕</button>
              </div>
              <div className="modal-body">
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--t1)' }}>Are you sure you want to delete this uploaded file?</div>
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--t3)' }}>
                  This action cannot be undone.
                </div>
              </div>
              <div className="modal-foot">
                <button className="btn btn-outline" onClick={() => setDeleteTarget(null)}>Cancel</button>
                <button className="btn btn-red" onClick={confirmDeleteImage}>Delete</button>
              </div>
            </div>
          </div>
        )}

        {apiError && (
          <ErrorModal open={true} title={apiError.title} message={apiError.message} onClose={() => setApiError(null)} />
        )}

      </div>
    </div>
  );
}