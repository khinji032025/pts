import React from 'react';

export default function StatusBadge({ action, dept }) {
  if (!action) return <span className="badge b-none">No Status</span>;
  let cls, icon;
  if (action === 'IN') {
    cls = 'b-in';
    icon = '↓';
  } else if (action === 'OUT') {
    cls = 'b-out';
    icon = '↑';
  } else if (action === 'RETURNED') {
    cls = 'b-returned';
    icon = '↶';
  } else {
    cls = 'b-done';
    icon = '✓';
  }
  
  return (
    <span className={`badge ${cls}`}>
      {icon} {action}{dept ? ` @ ${dept}` : ''}
    </span>
  );
}
