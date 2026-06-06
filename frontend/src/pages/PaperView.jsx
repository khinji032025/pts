import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { paperAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import StatusBadge from '../components/StatusBadge';
import QRCode from '../components/QRCode';
import Barcode from '../components/Barcode';
import usePaperNotifications from '../hooks/usePaperNotifications';
import ErrorModal from '../components/ErrorModal';
import UndoConfirmModal from '../components/UndoConfirmModal';

export default function PaperView() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [paper, setPaper]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [editLog, setEditLog] = useState(null);
  const [personName, setPersonName] = useState(user?.username || '');
  const [markRemark, setMarkRemark] = useState('');
  const [msg, setMsg]         = useState('');
  const [error, setError]     = useState('');
  const [previewImage, setPreviewImage] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [undoModalOpen, setUndoModalOpen] = useState(false);
  const [undoNote, setUndoNote] = useState('');
  const [undoLoading, setUndoLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const { notifCount, recentPapers, markNotificationsSeen, markNotificationRead, clearHistory } = usePaperNotifications();

  const isAdmin = user?.role === 'admin';
  const currentStatus = paper?.status_action || null;
  const currentStatusDept = paper?.status_dept || null;
  const isOriginDept = !!(user?.dept_name && paper?.origin && user.dept_name === paper.origin);
  const hasUserMarkedPaper = !!paper?.logs?.some(log => String(log.user_id) === String(user?.id) && ['IN', 'OUT'].includes(log.action));
  const canCapture = isAdmin || isOriginDept || currentStatus === null || hasUserMarkedPaper;
  const canDeleteImage = isAdmin || isOriginDept || hasUserMarkedPaper;
  const isCurrentDept = !!(user?.dept_name && currentStatusDept && user.dept_name === currentStatusDept);
  const formatDateTime = (value) => value ? new Date(value).toLocaleString('en-PH') : '—';
  const latestLog = paper?.logs?.[0] || null;
  const isLatestLogOwner = latestLog && String(latestLog.user_id) === String(user?.id);
  const isEditableLog = (log) => isAdmin || (latestLog && isLatestLogOwner && latestLog.id === log.id);
  const canEditAnyLog = isAdmin || isLatestLogOwner;

  const canMarkIn = isAdmin || currentStatus === 'OUT' || currentStatus === null;
  const canMarkOut = isAdmin || (currentStatus === 'IN' && isCurrentDept);
  const canMarkDone = isAdmin || ((currentStatus === 'IN' || currentStatus === 'OUT') && isCurrentDept);
  const canUseQuickStatus = isAdmin || currentStatus === 'OUT' || currentStatus === null || isCurrentDept;

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
        action === 'DONE' && currentStatus === 'DONE' ? 'Duplicate DONE. This paper is already marked DONE.' :
        'This status update is not allowed right now.';
      setMsg(`⚠️ ${warning}`);
      setTimeout(() => setMsg(''), 3500);
      return;
    }
    await mark(action, personName.trim() || user?.username || '');
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

  useEffect(() => {
    if (user?.username) setPersonName(user.username);
  }, [user?.username]);

  const mark = async (action, person) => {
    try {
      await paperAPI.mark({ paper_id: parseInt(id), action, dept_id: user.dept_id, note: markRemark.trim() || 'manual', person });
      setMsg(`Marked ${action}.`);
      setMarkRemark('');
      load();
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setMsg('Error: ' + (err.response?.data?.error || 'Failed'));
    }
  };

  const undoMark = async () => {
    setUndoLoading(true);
    try {
      const response = await paperAPI.undoMark(parseInt(id), undoNote.trim());
      setMsg(response.data?.message || 'Status reverted.');
      setUndoModalOpen(false);
      setUndoNote('');
      load();
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setMsg('Error: ' + (err.response?.data?.error || 'Failed to undo'));
    } finally {
      setUndoLoading(false);
    }
  };

  const saveLog = async () => {
    try {
      await paperAPI.editLog(editLog.id, { action: editLog.action, person: editLog.person || '', note: editLog.note });
      setEditLog(null);
      load();
    } catch {}
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
      <Navbar title="QR Office" notifCount={notifCount} recentPapers={recentPapers} onNotificationsClick={markNotificationsSeen} onNotificationRead={markNotificationRead} onClearHistory={clearHistory} />
      <div className="page">
        <button className="btn btn-outline btn-sm mb4" onClick={() => nav(user?.role === 'admin' ? '/admin' : '/dept')}>← Back</button>
        <div className="alert a-err">{error}</div>
      </div>
    </div>
  );

  if (!paper) return null;

  return (
    <div>
      <Navbar title="QR Office" notifCount={notifCount} recentPapers={recentPapers} onNotificationsClick={markNotificationsSeen} onClearHistory={clearHistory} />
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
                  {currentStatus !== 'DONE' && (
                    <>
                      <div>
                        <label className="lbl" style={{ display: 'block', marginBottom: 6 }}>Person</label>
                        <input
                          className="inp"
                          type="text"
                          value={personName}
                          placeholder="Name of person who submitted/marked this paper"
                          onChange={e => setPersonName(e.target.value)}
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div>
                        <label className="lbl" style={{ display: 'block', marginBottom: 6 }}>Remarks</label>
                        <textarea
                          className="inp"
                          rows={3}
                          placeholder="Optional instructions, issues, or notes for the next department."
                          value={markRemark}
                          onChange={e => setMarkRemark(e.target.value)}
                          style={{ width: '100%', resize: 'vertical' }}
                        />
                      </div>
                    </>
                  )}
                  {currentStatus === 'DONE' ? (
                    <div>
                      <p className="sm muted" style={{ marginBottom: 12 }}>This paper is marked as completed.</p>
                      <button
                        className="btn btn-outline"
                        onClick={() => setUndoModalOpen(true)}
                        style={{ width: '100%' }}
                      >↶ Undo</button>
                    </div>
                  ) : canUseQuickStatus ? (
                    <div className="row">
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
                    </div>
                  ) : null}
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
                <div className="sm muted mt4">Scan with the in-app scanner; clicking will not change status.</div>
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
          <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="card-title">🖼️ Document Image</span>
            {canCapture && (
              <button className="btn btn-gold btn-sm" onClick={() => nav(`/paper/${id}/capture`)}>
                📷 Upload Image
              </button>
            )}
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
                        {canDeleteImage && (
                          <button type="button" className="btn btn-red btn-sm" onClick={() => deleteImage(img)}>✕</button>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--t3)' }}>
                        <div>{new Date(img.uploaded_at).toLocaleDateString('en-PH')} {new Date(img.uploaded_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}</div>
                        <div style={{ marginTop: 3 }}>By: <strong>{img.username || '—'}</strong></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="center" style={{ padding: '20px 0', color: 'var(--t3)' }}>
                No image yet.
                <br />
                {canCapture ? (
                  <button className="btn btn-gold btn-sm" style={{ marginTop: 12 }} onClick={() => nav(`/paper/${id}/capture`)}>📷 Capture Document Image</button>
                ) : (
                  <div style={{ margin: '12px auto 0', maxWidth: 300, textAlign: 'center' }}>
                    Capture is only available to the paper origin department or an administrator, or if your account previously marked this paper IN/OUT.
                  </div>
                )}
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
                  <th>Remarks</th>
                  {canEditAnyLog && <th>Edit</th>}
                </tr>
              </thead>
              <tbody>
                {paper.logs?.length > 0 ? paper.logs.map(log => (
                  <tr key={log.id}>
                    <td className="sm muted" style={{ whiteSpace: 'nowrap' }}>{new Date(log.created_at).toLocaleString('en-PH')}</td>
                    <td>
                      {editLog?.id === log.id && isAdmin
                        ? <select className="sel" style={{ width: 80 }} value={editLog.action} onChange={e => setEditLog(l => ({ ...l, action: e.target.value }))}>
                            <option>IN</option><option>OUT</option><option>DONE</option>
                          </select>
                        : <StatusBadge action={log.action} />}
                    </td>
                    <td>{log.dept_name}</td>
                    <td className="sm muted">{log.username}</td>
                    <td className="sm">
                      {editLog?.id === log.id && isAdmin
                        ? <input className="inp" style={{ width: 140 }} value={editLog.person} onChange={e => setEditLog(l => ({ ...l, person: e.target.value }))} />
                        : log.person || '—'}
                    </td>
                    <td>
                      {editLog?.id === log.id
                        ? <input className="inp" style={{ width: 110 }} value={editLog.note} onChange={e => setEditLog(l => ({ ...l, note: e.target.value }))} />
                        : <span className="badge b-none">{log.note || 'manual'}</span>}
                    </td>
                    {canEditAnyLog && (
                      <td>
                        {editLog?.id === log.id
                          ? <div className="row" style={{ gap: 4 }}>
                              <button className="btn btn-navy btn-sm" onClick={saveLog}>Save</button>
                              <button className="btn btn-outline btn-sm" onClick={() => setEditLog(null)}>Cancel</button>
                            </div>
                          : isEditableLog(log)
                              ? <button className="btn btn-outline btn-sm" onClick={() => setEditLog({ id: log.id, action: log.action, person: log.person || '', note: log.note || '' })}>Edit</button>
                              : null}
                      </td>
                    )}
                  </tr>
                )) : (
                  <tr><td colSpan={canEditAnyLog ? 7 : 6} style={{ textAlign: 'center', padding: 24, color: 'var(--t3)' }}>No status history yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Attachments History */}
        {paper.images?.length > 0 && (
          <div className="card full-span">
            <div className="card-head">
              <span className="card-title">📎 Attachments History</span>
              <span className="badge b-none">{paper.images?.length || 0} files</span>
            </div>
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Upload Time</th>
                    <th>Uploaded By</th>
                    <th>File</th>
                  </tr>
                </thead>
                <tbody>
                  {paper.images.map(img => (
                    <tr key={img.id}>
                      <td className="sm muted" style={{ whiteSpace: 'nowrap' }}>
                        <div>{new Date(img.uploaded_at).toLocaleDateString('en-PH')}</div>
                        <div style={{ fontSize: '11px' }}>{new Date(img.uploaded_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                      </td>
                      <td className="sm" style={{ fontWeight: 500 }}>{img.username || '—'}</td>
                      <td className="sm">
                        <button className="btn btn-outline btn-sm" onClick={() => viewImage(img)}>View File</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

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
        <UndoConfirmModal
          open={undoModalOpen}
          note={undoNote}
          onNoteChange={setUndoNote}
          loading={undoLoading}
          onCancel={() => setUndoModalOpen(false)}
          onConfirm={undoMark}
        />

      </div>
    </div>
  );
}