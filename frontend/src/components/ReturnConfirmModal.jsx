import React from 'react';

export default function ReturnConfirmModal({ open, onCancel, onConfirm, note, onNoteChange, loading }) {
  if (!open) return null;
  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onCancel && onCancel()}>
      <div className="modal" style={{ maxWidth: 540 }}>
        <div className="modal-head">
          <div className="modal-title">Return Document</div>
          <button className="btn btn-outline btn-sm" onClick={onCancel}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: 14, color: 'var(--t1)', marginBottom: 12 }}>
            This will send the document back to the originating department. Only the <strong>Mark In</strong> user can re-scan the returned document.
          </div>
          <div style={{ marginBottom: 12 }}>
            <label className="lbl">Reason for Return <span style={{ color: 'var(--red)' }}>*</span></label>
            <textarea
              className="inp"
              value={note}
              onChange={e => onNoteChange(e.target.value)}
              placeholder="Enter the reason for returning this document (e.g., missing signature, locked document, etc.)"
              rows={4}
              style={{ width: '100%', resize: 'vertical' }}
              required
            />
          </div>
          <div style={{ fontSize: 12, color: 'var(--t3)' }}>
            The reason will be stored with the return action and displayed when the document is re-scanned.
          </div>
        </div>
        <div className="modal-foot" style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={onCancel}>Cancel</button>
          <button className="btn btn-amber" onClick={onConfirm} disabled={loading || !note.trim()}>
            {loading ? 'Returning…' : 'Confirm Return'}
          </button>
        </div>
      </div>
    </div>
  );
}
