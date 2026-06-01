import React from 'react';

export default function MarkerRoleWarningModal({ markerRole, attemptedAction, onClose }) {
  const assignedRoleLabel = markerRole === 'UNASSIGNED' ? 'No role assigned' : markerRole;
  const isUnassigned = markerRole === 'UNASSIGNED';

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-head">
          <span className="modal-title">⚠️ Role Restriction</span>
          <button className="btn btn-outline btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="alert a-err">
            <strong>{isUnassigned ? 'You have no assigned marker role.' : 'You are assigned to mark papers as:'}</strong>
            <div style={{ fontSize: '16px', marginTop: '8px', fontWeight: 'bold' }}>{assignedRoleLabel}</div>
            {!isUnassigned && (
              <>
                <hr style={{ margin: '12px 0', opacity: 0.3 }} />
                <strong>But you are attempting to mark as:</strong>
                <div style={{ fontSize: '16px', marginTop: '8px', fontWeight: 'bold', color: '#dc3545' }}>{attemptedAction}</div>
              </>
            )}
          </div>
          <p style={{ marginTop: '16px', color: 'var(--t3)', fontSize: '13px' }}>
            {isUnassigned
              ? 'You must be assigned IN or OUT to mark papers. Please contact your department administrator.'
              : 'This action is not allowed. Please contact your department administrator if you need your role to be changed.'
            }
          </p>
        </div>
        <div className="modal-foot">
          <button className="btn btn-outline btn-full" onClick={onClose}>OK, I Understand</button>
        </div>
      </div>
    </div>
  );
}
