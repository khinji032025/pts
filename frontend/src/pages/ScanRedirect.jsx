import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { paperAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';

export default function ScanRedirect() {
  const { id: scannedRef } = useParams();
  const nav = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [paper, setPaper]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [done, setDone]     = useState('');
  const [error, setError]   = useState('');

  const warningCard = (title, message) => (
    <div style={styles.bg}>
      <div style={styles.card}>
        <div style={styles.header}>⚠️ Warning</div>
        <div style={{ padding: 24, textAlign: 'center', color: '#8a5b00' }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: '#7a4b00', marginBottom: 10 }}>{title}</div>
          <div style={{ fontSize: 14, lineHeight: 1.55 }}>{message}</div>
        </div>
        <div style={{ padding: '0 24px 24px', textAlign: 'center' }}>
          <button style={styles.btnOutline} onClick={() => nav('/dept')}>Go to Dashboard</button>
        </div>
      </div>
    </div>
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user) { nav(`/login?next=/scan/${scannedRef}`); return; }

    const runScan = async () => {
      try {
        // Guard against duplicate effect execution (e.g., React StrictMode in development)
        const lockKey = `scan-lock-${scannedRef}-${user?.uid || user?.username || 'user'}`;
        const doneKey = `scan-done-${scannedRef}-${user?.uid || user?.username || 'user'}`;
        const now = Date.now();
        const last = Number(sessionStorage.getItem(lockKey) || 0);
        // If we've already performed an auto-scan for this ref recently, load details
        // without triggering another auto-mark. This protects against users
        // navigating back from the details view which would remount this component
        // and re-run the effect.
        if (sessionStorage.getItem(doneKey)) {
          const r = await paperAPI.publicView(scannedRef);
          setPaper(r.data.paper);
          setDone(r.data.paper?.status_action || '');
          return;
        }

        // Before performing an auto-scan (which may change status), fetch the
        // public details to verify the paper's current holder. Only the
        // department that currently has the paper marked IN should be able to
        // mark it OUT. If another department scans, show a warning instead of
        // auto-marking.
        const preview = await paperAPI.publicView(scannedRef);
        const current = preview.data.paper;
        if (current) {
          const isAdmin = user?.role === 'admin';
          const isOriginDept = user?.dept_name && current.origin && user.dept_name === current.origin;

          // Non-admins may only auto-scan a paper if they belong to its origin
          // department, or if the paper is already finished. This prevents other
          // departments from scanning unfinished papers that belong to a different
          // origin department.
          if (!isAdmin && !isOriginDept && current.status_action !== 'DONE') {
            setPaper(current);
            setError(
              <div>
                <div>This document belongs to <strong>{current.origin}</strong>.</div>
                <div style={{ marginTop: 8 }}>Only the origin department or an administrator may scan it until it is marked DONE.</div>
                <div style={{ marginTop: 12, color: '#555' }}>Current status: <strong>{current.status_action || 'PENDING'}</strong>{current.status_dept ? ` at ${current.status_dept}` : ''}</div>
              </div>
            );
            setLoading(false);
            return;
          }

          // If it's IN at another department, block auto-scan and warn the user.
          if (current.status_action === 'IN' && current.status_dept && current.status_dept !== user?.dept_name) {
            setPaper(current);
            setError(
              <div>
                <div>This document is currently marked IN at <strong>{current.status_dept}</strong>. Only that department may mark it OUT.</div>
                <div style={{ marginTop: 12, color: '#555' }}>Note: You can access or scan this paper once it has been marked OUT or DONE by the current holder.</div>
              </div>
            );
            setLoading(false);
            return;
          }
        }

        if (now - last <= 2500) {
          // Duplicate effect detected (e.g., StrictMode). Skip duplicate request.
          return;
        }

        sessionStorage.setItem(lockKey, String(now));

        const r = await paperAPI.scan(scannedRef, { auto: 1 });
        const scannedPaper = r.data.paper;
        setPaper(scannedPaper);
        setDone(scannedPaper?.status_action || 'IN');
        // Remember that we've auto-scanned this ref so we don't auto-mark again
        // when the user navigates back to this route shortly after.
        sessionStorage.setItem(doneKey, '1');
      } catch (err) {
        setError(err.response?.data?.error || 'Paper not found.');
      } finally {
        setLoading(false);
      }
    };

    runScan();
  }, [scannedRef, user, authLoading, nav]);

  if (authLoading || loading || !paper) return (
    <div style={styles.bg}>
      <div style={styles.card}>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div className="spinner" style={{ margin: '0 auto' }} />
          <p style={{ marginTop: 12, color: '#888' }}>Loading paper...</p>
        </div>
      </div>
    </div>
  );

  if (error) return (
    <div style={styles.bg}>
      <div style={styles.card}>
        <div style={styles.header}>❌ Error</div>
        <div style={{ padding: 24, textAlign: 'center', color: '#b91c1c' }}>{error}</div>
        <div style={{ padding: '0 24px 24px', textAlign: 'center' }}>
          <button style={styles.btnOutline} onClick={() => nav('/dept')}>Go to Dashboard</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={styles.bg}>
      <div style={styles.card}>

        {/* Header */}
        <div style={styles.header}>
          <div style={styles.logo}>PTS</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#0d1b35' }}>Paper Tracking System</div>
            <div style={{ fontSize: 12, color: '#9aa0b8' }}>QR Scan — {user?.dept_name}</div>
          </div>
        </div>

        {/* Paper info */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #eee' }}>
          <div style={styles.row}>
            <span style={styles.label}>REF</span>
            <span style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 800, color: '#0d1b35' }}>#{paper.ref_code}</span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>TITLE</span>
            <span style={{ fontWeight: 600 }}>{paper.title}</span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>ORIGIN</span>
            <span>{paper.origin}</span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>STATUS</span>
            <StatusBadge action={paper.status_action} dept={paper.status_dept} />
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ padding: 24 }}>
          {done ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>{done === 'IN' ? '✅' : done === 'OUT' ? '📤' : '🏁'}</div>
              <div style={{ fontWeight: 700, fontSize: 18, color: '#1a7f4e', marginBottom: 4 }}>
                Marked {done}!
              </div>
              <div style={{ fontSize: 13, color: '#888', marginBottom: 6 }}>Status updated successfully.</div>
              <div style={{ fontSize: 12, color: '#5a6480', marginBottom: 20 }}>
                Scanned by: <strong>{paper?.status_dept || user?.dept_name || '—'}</strong>
              </div>
              <button style={styles.btnOutline} onClick={() => nav(user?.role === 'admin' ? '/admin' : '/dept')}>
                ← Back to Dashboard
              </button>
              <div style={{ marginTop: 10 }}>
                <button style={styles.btnOutline} onClick={() => nav(`/paper/${paper?.id}`)}>
                  View Full Details
                </button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <button style={styles.btnOutline} onClick={() => nav(`/paper/${paper?.id}`)}>
                View Details
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

const styles = {
  bg: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0d1b35 0%, #1a2f5a 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 16,
  },
  card: {
    background: '#fff', borderRadius: 20,
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    width: '100%', maxWidth: 400,
    overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '20px 24px', borderBottom: '1px solid #eee',
    background: '#f8f5ef',
  },
  logo: {
    width: 42, height: 42, borderRadius: '50%',
    background: '#0d1b35', border: '2px solid #c9a84c',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 800, color: '#c9a84c', letterSpacing: 1,
  },
  row: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '8px 0', borderBottom: '1px solid #f0f0f0',
  },
  label: {
    fontSize: 10, fontWeight: 700, color: '#9aa0b8',
    textTransform: 'uppercase', letterSpacing: '.5px', width: 55, flexShrink: 0,
  },
  btnIN: {
    width: '100%', padding: '14px', border: 'none', borderRadius: 10,
    background: '#1a7f4e', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
  },
  btnOUT: {
    width: '100%', padding: '14px', border: 'none', borderRadius: 10,
    background: '#d97706', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
  },
  btnDONE: {
    width: '100%', padding: '14px', border: 'none', borderRadius: 10,
    background: '#1d4ed8', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
  },
  btnOutline: {
    padding: '10px 20px', border: '1.5px solid #ddd', borderRadius: 8,
    background: '#fff', color: '#5a6480', fontSize: 13, fontWeight: 500, cursor: 'pointer',
  },
};