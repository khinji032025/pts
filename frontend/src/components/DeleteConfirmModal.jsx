import React from 'react';

export default function DeleteConfirmModal({ open, subjectLabel = 'item', subjectName = '', onCancel, onConfirm }) {
  if (!open) return null;
  const label = subjectLabel || 'item';
  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onCancel && onCancel()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-head">
          <div className="modal-title">Confirm Delete</div>
          <button className="btn btn-outline btn-sm" onClick={onCancel}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: 14, color: 'var(--t1)', marginBottom: 8 }}>
            Are you sure you want to delete {label} {subjectName ? <strong>{subjectName}</strong> : null}? This action cannot be undone.
          </div>
        </div>
        <div className="modal-foot" style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={onCancel}>Cancel</button>
          <button className="btn btn-red" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}
