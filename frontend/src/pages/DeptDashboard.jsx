import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import PapersTable from '../components/PapersTable';
import { paperAPI } from '../utils/api';
import usePaperNotifications from '../hooks/usePaperNotifications';

export default function DeptDashboard() {
  const { user } = useAuth();
  const [title, setTitle]   = useState('');
  const [error, setError]   = useState('');
  const [ok, setOk]         = useState('');
  const [refresh, setRefresh] = useState(0);
    const { notifCount, recentPapers, markNotificationsSeen, markNotificationRead } = usePaperNotifications();

  const create = async (e) => {
    e.preventDefault(); setError(''); setOk('');
    try {
      const r = await paperAPI.create({ title, dept_id: user.dept_id });
      setOk(`Created! Ref #${r.data.ref_code}`);
      setTitle('');
      setRefresh(n=>n+1);
      markNotificationsSeen();
      setTimeout(()=>setOk(''),4000);
    } catch (err) { setError(err.response?.data?.error||'Failed.'); }
  };

  return (
    <div>
      <Navbar 
        title={`QR Office — ${user?.dept_name}`} 
        greeting={`Welcome, ${user?.username}! You are in ${user?.dept_name}`}
        dept_id={user?.dept_id}
        dept_name={user?.dept_name}
        notifCount={notifCount}
        recentPapers={recentPapers}
          onNotificationsClick={markNotificationsSeen}
          onNotificationRead={markNotificationRead}
      />
      <div className="page">

        <div className="card mb6">
          <div className="card-head"><span className="card-title">📝 Create New File / Paper</span></div>
          <div className="card-body">
            {error && <div className="alert a-err">{error}</div>}
            {ok    && <div className="alert a-ok">{ok}</div>}
            <form onSubmit={create}>
                <div className="frow dept-paper-form-row">
                <div className="fg" style={{flex:3}}>
                  <label className="lbl">Document Name / Title</label>
                  <input className="inp" required placeholder="Enter document title…" value={title} onChange={e=>setTitle(e.target.value)} />
                </div>
                  <div className="fg form-actions create-actions dept-paper-create-actions">
                  <button type="submit" className="btn btn-navy create-btn">Create</button>
                </div>
              </div>
            </form>
          </div>
        </div>

        <PapersTable refresh={refresh} />
      </div>
    </div>
  );
}
