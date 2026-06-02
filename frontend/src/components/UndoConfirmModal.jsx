import React from 'react';

export default function UndoConfirmModal({ open, onCancel, onConfirm, note, onNoteChange, loading }) {
  if (!open) return null;
  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onCancel && onCancel()}>
      <div className="modal" style={{ maxWidth: 540 }}>
        <div className="modal-head">
          <div className="modal-title">Confirm Undo</div>
          <button className="btn btn-outline btn-sm" onClick={onCancel}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: 14, color: 'var(--t1)', marginBottom: 12 }}>
            This will revert the paper from <strong>DONE</strong> back to its previous status.
          </div>
          <div style={{ marginBottom: 12 }}>
            <label className="lbl">Reason for undo (optional)</label>
            <textarea
              className="inp"
              value={note}
              onChange={e => onNoteChange(e.target.value)}
              placeholder="Enter a note or reason for this undo"
              rows={4}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>
          <div style={{ fontSize: 12, color: 'var(--t3)' }}>
            The note will be stored with the undo action for audit purposes.
          </div>
        </div>
        <div className="modal-foot" style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={onCancel}>Cancel</button>
          <button className="btn btn-red" onClick={onConfirm} disabled={loading}>
            {loading ? 'Undoing…' : 'Confirm Undo'}
          </button>
        </div>
      </div>
    </div>
  );
}
