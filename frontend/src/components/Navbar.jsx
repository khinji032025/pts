import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ChangePasswordModal from './ChangePasswordModal';
import ScanModal from './ScanModal';
import DepartmentQRModal from './DepartmentQRModal';
import DepartmentUsersModal from './DepartmentUsersModal';

export default function Navbar({ title, sub, greeting, notifCount = 0, recentPapers = [], dept_id, dept_name, onNotificationsClick, onNotificationOpen, onNotificationRead }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [showPw, setShowPw] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [showDeptQR, setShowDeptQR] = useState(false);
  const [showDeptUsers, setShowDeptUsers] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [dateTime, setDateTime] = useState(() => new Date());
  const notifRef = useRef(null);
  const showNotifications = user?.role === 'department';

  const getSmartGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const welcomeName = user?.username || 'User';
  const welcomeMessage = `${getSmartGreeting()}, ${welcomeName}!`;

  useEffect(() => {
    const onDocClick = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifMenu(false);
      }
    };

    // Handle both mouse and touch events for better mobile compatibility
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('touchstart', onDocClick);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('touchstart', onDocClick);
    };
  }, []);

  useEffect(() => {
    if (!user || !greeting) return;
    // Don't show welcome overlay for admin users to avoid blocking interactions on mobile
    if (user?.role === 'admin') return;
    const key = `pts:welcomeShownFor:${user.id}`;
    try {
      const shown = sessionStorage.getItem(key);
      if (!shown) {
        setShowWelcome(true);
        sessionStorage.setItem(key, '1');
        const t = setTimeout(() => setShowWelcome(false), 3000);
        return () => clearTimeout(t);
      }
    } catch (e) {}
  }, [user, greeting]);

  useEffect(() => {
    const tick = () => setDateTime(new Date());
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedDate = new Intl.DateTimeFormat('en-PH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(dateTime);

  const formattedTime = new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(dateTime);

  const doLogout = async () => {
    try { if (user?.id) sessionStorage.removeItem(`pts:welcomeShownFor:${user.id}`); } catch (e) {}
    await logout();
    nav('/login');
  };

  const openNotification = (paper) => {
    setShowNotifMenu(false);
    if (onNotificationOpen) onNotificationOpen();
    if (paper?.id) nav(`/paper/${paper.id}`);
  };

  return (
    <>
      <nav className="navbar">
        <div className="nb-brand">
          <img src="/logo-dashboard.png" alt="Logo" style={{ width:34, height:34, borderRadius:'50%', objectFit:'cover' }} />
          <div>
            <span className="nb-title">{title || 'QR Office'}</span>
            <span className="nb-meta">{formattedDate}</span>
            <span className="nb-meta">{formattedTime}</span>
            {!greeting && sub && <span className="nb-sub">{sub}</span>}
          </div>
        </div>
        <div className="nb-actions" ref={notifRef} style={{ position: 'relative' }}>
          {showNotifications && (
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setShowNotifMenu(v => !v)} style={{ position: 'relative' }}>
              🔔 Notifications
              {notifCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  background: '#dc2626',
                  color: '#fff',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '700'
                }}>
                  {notifCount}
                </span>
              )}
            </button>
          )}
          {showNotifications && showNotifMenu && (
            <div className="notif-menu" style={{
              top: 'calc(100% + 10px)',
              right: 0,
              width: '340px',
              background: '#fff',
              color: 'var(--t1)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              boxShadow: 'var(--sh3)',
              overflow: 'hidden',
              zIndex: 200,
            }}>
              <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: 13 }}>New papers</strong>
                <button className="btn btn-outline btn-sm" type="button" onClick={() => { setShowNotifMenu(false); if (onNotificationsClick) onNotificationsClick(); }}>
                  Mark all seen
                </button>
              </div>
              <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                {recentPapers.length > 0 ? recentPapers.map(paper => (
                  <div key={paper.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
                    <button
                      type="button"
                      onClick={() => openNotification(paper)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '12px 14px',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>Ref #{paper.ref_code} · {paper.origin}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{paper.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>
                        {new Date(paper.created_at).toLocaleString('en-PH', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </button>
                    <div style={{ padding: '8px' }}>
                      {paper.is_read ? (
                        <span style={{ color: 'green', fontWeight: 700, padding: '6px 8px' }}>✓</span>
                      ) : (
                        onNotificationRead && <button className="btn btn-outline btn-sm" onClick={() => onNotificationRead(paper.id)}>Mark</button>
                      )}
                    </div>
                  </div>
                )) : (
                  <div style={{ padding: '16px 14px', color: 'var(--t3)', fontSize: 13 }}>
                    No new papers.
                  </div>
                )}
              </div>
            </div>
          )}
          {dept_id && dept_name && (
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setShowDeptUsers(true)}>👥 Manage Department Users</button>
          )}
          {dept_id && dept_name && (
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setShowDeptQR(true)}>🏢 Department QR</button>
          )}
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => setShowScan(true)}>📷 Scan</button>
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => setShowPw(true)}>🔑 Password</button>
          <button className="btn btn-ghost btn-sm" type="button" onClick={doLogout}>⏻ Logout</button>
        </div>
      </nav>
      {showPw && <ChangePasswordModal onClose={() => setShowPw(false)} />}
      {showScan && <ScanModal onClose={() => setShowScan(false)} />}
      {showDeptUsers && (
        <DepartmentUsersModal
          dept_id={dept_id}
          dept_name={dept_name}
          onClose={() => setShowDeptUsers(false)}
        />
      )}
      {showDeptQR && <DepartmentQRModal dept_id={dept_id} dept_name={dept_name} onClose={() => setShowDeptQR(false)} />}
      {showWelcome && (greeting || user) && (
        <div className="welcome-overlay">
          <div className="welcome-box">
            <div style={{ fontSize:18, fontWeight:700, color:'var(--navy)' }}>Welcome</div>
            <div style={{ marginTop:8, fontSize:14 }}>{welcomeMessage}</div>
          </div>
        </div>
      )}
    </>
  );
}
