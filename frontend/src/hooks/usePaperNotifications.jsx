import { useCallback, useEffect, useState } from 'react';
import { paperAPI, notificationsAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
const POLL_INTERVAL = 15000;

export default function usePaperNotifications() {
  const { user } = useAuth();
  const [notifCount, setNotifCount] = useState(0);
  const [recentPapers, setRecentPapers] = useState([]);
  const isDepartmentUser = user?.role === 'department' && !!user?.dept_id;

  const refreshNotifications = useCallback(async () => {
    if (!isDepartmentUser) return;
    try {
      const r = await notificationsAPI.list();
      const items = r.data.notifications || [];
      setRecentPapers(items.slice(0, 5));
      setNotifCount(Number(r.data.unread || 0));
    } catch {
      // ignore errors and keep previous state
    }
  }, [isDepartmentUser]);

  useEffect(() => {
    if (!isDepartmentUser) return;
    refreshNotifications();
    const timer = window.setInterval(refreshNotifications, POLL_INTERVAL);
    return () => window.clearInterval(timer);
  }, [isDepartmentUser, refreshNotifications]);

  const markNotificationsSeen = useCallback(async () => {
    if (!isDepartmentUser) return;
    try {
      await notificationsAPI.markAllRead();
      // keep the list visible but mark all as read locally for instant feedback
      setRecentPapers(prev => prev.map(p => ({ ...p, is_read: true })));
      setNotifCount(0);
      // refresh in background
      setTimeout(() => refreshNotifications(), 500);
    } catch {}
  }, [isDepartmentUser]);

  const markNotificationRead = useCallback(async (notif_id) => {
    if (!isDepartmentUser || !notif_id) return;
    try {
      await notificationsAPI.markRead({ notif_id });
      // optimistic UI update
      setRecentPapers(prev => prev.map(p => p.notif_id === notif_id ? { ...p, is_read: true } : p));
      setNotifCount(c => Math.max(0, c - 1));
      // refresh in background
      setTimeout(() => refreshNotifications(), 500);
    } catch {}
  }, [isDepartmentUser, refreshNotifications]);

  const clearHistory = useCallback(async () => {
    if (!isDepartmentUser) return;
    try {
      await notificationsAPI.clearHistory();
      setRecentPapers([]);
      setNotifCount(0);
      // refresh in background
      setTimeout(() => refreshNotifications(), 500);
    } catch {}
  }, [isDepartmentUser, refreshNotifications]);

  return { notifCount, recentPapers, refreshNotifications, markNotificationsSeen, markNotificationRead, clearHistory };
}