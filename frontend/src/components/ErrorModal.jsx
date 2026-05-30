import React from 'react';

export default function ErrorModal({ open, title = 'Error', message = '', onClose }) {
  if (!open) return null;
  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose && onClose()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-head">
          <div className="modal-title">{title}</div>
          <button className="btn btn-outline btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: 14, color: 'var(--t1)', marginBottom: 8 }}>{message}</div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-outline" onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  );
}
