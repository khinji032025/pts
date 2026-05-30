import React from 'react';

export default function StatusBadge({ action, dept }) {
  if (!action) return <span className="badge b-none">No Status</span>;
  const cls = action === 'IN' ? 'b-in' : action === 'OUT' ? 'b-out' : 'b-done';
  const icon = action === 'IN' ? '↓' : action === 'OUT' ? '↑' : '✓';
  return (
    <span className={`badge ${cls}`}>
      {icon} {action}{dept ? ` @ ${dept}` : ''}
    </span>
  );
}
