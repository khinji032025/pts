import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import AdminDepartments from './admin/AdminDepartments';
import AdminUsers from './admin/AdminUsers';
import AdminPapers from './admin/AdminPapers';
import usePaperNotifications from '../hooks/usePaperNotifications';
import LoginHistoryModal from '../components/LoginHistoryModal';

const TABS = [
  { key:'departments', label:'🏢 Departments' },
  { key:'users',       label:'👥 Users' },
  { key:'papers',      label:'📄 Papers' },
];

export default function AdminDashboard() {
  const { user } = useAuth();
  const loc = useLocation();
  const [tab, setTab] = useState('departments');
  const [showLoginHistory, setShowLoginHistory] = useState(false);
  const { notifCount, recentPapers, markNotificationsSeen, markNotificationRead } = usePaperNotifications();

  useEffect(() => {
    // If coming back from capture, set tab to papers
    if (loc.state?.tab) {
      setTab(loc.state.tab);
    }
  }, [loc.state]);

  // Ensure buttons are clickable on mobile by forcing a layout reflow after render
  useEffect(() => {
    const timer = setTimeout(() => {
      // Force a reflow to ensure all elements are properly rendered and interactive
      void document.documentElement.offsetHeight;
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="admin-shell">
      <Navbar
        title="QR Office Admin"
        greeting={`Welcome, ${user?.username}! You are Administrator`}
        notifCount={notifCount}
        recentPapers={recentPapers}
        onNotificationsClick={() => { markNotificationsSeen(); setTab('papers'); }}
        onNotificationRead={markNotificationRead}
        onNotificationOpen={() => setTab('papers')}
      />
      <div className="admin-secondary-nav">
        <div className="tabs admin-tabs">
          {TABS.map(t => (
            <button key={t.key} type="button" className={`tab ${tab===t.key?'active':''}`} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-outline btn-sm admin-history-btn" onClick={() => setShowLoginHistory(true)}>
          📜 Log History
        </button>
      </div>
      <div className="admin-mobile-history">
        <button type="button" className="btn btn-outline btn-sm admin-history-mobile-btn" onClick={() => setShowLoginHistory(true)}>
          📜 Log History
        </button>
      </div>
      <div className="page">
        {tab === 'departments' && <AdminDepartments />}
        {tab === 'users'       && <AdminUsers />}
        {tab === 'papers'      && <AdminPapers />}
      </div>
      {showLoginHistory && <LoginHistoryModal onClose={() => setShowLoginHistory(false)} />}
    </div>
  );
}
