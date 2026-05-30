import React, { useState, useEffect } from 'react';
import { paperAPI, deptAPI } from '../../utils/api';
import PapersTable from '../../components/PapersTable';
import usePaperNotifications from '../../hooks/usePaperNotifications';

export default function AdminPapers() {
  const [depts, setDepts]   = useState([]);
  const [form, setForm]     = useState({ title:'', dept_id:'' });
  const [error, setError]   = useState('');
  const [ok, setOk]         = useState('');
  const [refresh, setRefresh] = useState(0);
  const { markNotificationsSeen, markNotificationRead } = usePaperNotifications();

  useEffect(() => {
    deptAPI.list().then(r => {
      setDepts(r.data.departments);
      if (r.data.departments.length > 0) setForm(f=>({...f,dept_id:r.data.departments[0].id}));
    });
  }, []);

  const create = async (e) => {
    e.preventDefault(); setError(''); setOk('');
    try {
      const r = await paperAPI.create({ title:form.title, dept_id:form.dept_id });
      setOk(`Created! Ref #${r.data.ref_code}`);
      setForm(f=>({...f,title:''}));
      setRefresh(n=>n+1);
      markNotificationsSeen();
      // allow marking from notification list if needed
      // (Navbar will call markNotificationRead via prop)
      setTimeout(()=>setOk(''),4000);
    } catch (err) { setError(err.response?.data?.error||'Failed.'); }
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:22 }}>
      <div className="card">
        <div className="card-head"><span className="card-title">📝 Create Paper</span></div>
        <div className="card-body">
          {error && <div className="alert a-err">{error}</div>}
          {ok    && <div className="alert a-ok">{ok}</div>}
          <form onSubmit={create}>
            <div className="frow admin-paper-form-row">
              <div className="fg" style={{flex:3}}>
                <label className="lbl">Document Title</label>
                <input className="inp" required placeholder="Enter document title…" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} />
              </div>
              <div className="fg" style={{flex:2}}>
                <label className="lbl">Origin Department</label>
                <select className="sel" value={form.dept_id} onChange={e=>setForm(f=>({...f,dept_id:e.target.value}))}>
                  {depts.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="fg form-actions create-actions admin-paper-create-actions">
                <button type="submit" className="btn btn-navy create-btn">Create</button>
              </div>
            </div>
          </form>
        </div>
      </div>
      <PapersTable refresh={refresh} />
    </div>
  );
}
