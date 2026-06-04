import React, { useState, useEffect } from 'react';
import { deptAPI, authAPI } from '../../utils/api';

export default function AdminDepartments() {
  const [depts, setDepts]   = useState([]);
  const [name, setName]     = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [ok, setOk]         = useState('');

  const load = async () => {
    setLoading(true);
    try { const r = await deptAPI.list(); setDepts(r.data.departments); }
    catch { } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault(); setError(''); setOk('');
    try {
      const r = await deptAPI.create({ name });
      const deptId = r.data.id;
      try {
        await authAPI.logAdminActivity({
          action: 'Create Department',
          target_type: 'department',
          target_id: deptId,
          details: `Created department ${name}`,
        });
      } catch (logErr) {
        console.error('Admin activity log failed', logErr);
      }
      setName('');
      setOk(`"${name}" added.`);
      load();
    } catch (err) { setError(err.response?.data?.error || 'Failed.'); }
  };

  const del = async (d) => {
    if (!window.confirm(`Delete "${d.name}"?`)) return;
    try {
      await deptAPI.delete(d.id);
      try {
        await authAPI.logAdminActivity({
          action: 'Delete Department',
          target_type: 'department',
          target_id: d.id,
          details: `Deleted department ${d.name}`,
        });
      } catch (logErr) {
        console.error('Admin activity log failed', logErr);
      }
      load();
    } catch (err) { alert(err.response?.data?.error || 'Failed.'); }
  };

  return (
    <div className="g2 g2-admin" style={{ gap: 16 }}>
      <div className="card" style={{ alignSelf:'start', maxWidth: 360 }}>
        <div className="card-head"><span className="card-title">🏢 Add Department</span></div>
        <div className="card-body" style={{ padding: 16 }}>
          {error && <div className="alert a-err">{error}</div>}
          {ok    && <div className="alert a-ok">{ok}</div>}
          <form onSubmit={add}>
            <div className="fg" style={{ marginBottom: 12 }}><label className="lbl" style={{ fontSize: 13, marginBottom: 6 }}>Department Name</label>
              <input className="inp" style={{ fontSize: 13, padding: '9px 12px' }} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Budget Office" required /></div>
            <button type="submit" className="btn btn-navy btn-full" style={{ padding: '10px 0', fontSize: 14 }}>Add Department</button>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="card-title">All Departments</span>
          <span className="badge b-none">{depts.length}</span>
        </div>
        <div className="tbl-wrap">
          {loading ? <div style={{padding:24,textAlign:'center'}}><div className="spinner" style={{margin:'0 auto'}} /></div> : (
            <table style={{ fontSize: 13, borderCollapse: 'collapse' }}>
              <thead><tr><th style={{ padding: '10px 8px', fontSize: 13 }}>#</th><th style={{ padding: '10px 8px', fontSize: 13 }}>Name</th><th style={{ padding: '10px 8px', fontSize: 13 }}>Users</th><th style={{textAlign:'right', padding: '10px 8px', fontSize: 13}}>Actions</th></tr></thead>
              <tbody>
                {depts.map(d => (
                  <tr key={d.id}>
                    <td className="muted sm" style={{ padding: '10px 8px' }}>{d.id}</td>
                    <td style={{fontWeight:500, padding: '10px 8px'}}>{d.name}</td>
                    <td style={{ padding: '10px 8px' }}><span className="badge b-none" style={{ fontSize: 12, padding: '2px 8px' }}>{d.user_count}</span></td>
                    <td style={{textAlign:'right', padding: '10px 8px'}}>
                      <button className="btn btn-red btn-sm" style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => del(d)} disabled={d.user_count>0} title={d.user_count>0?'Has users':'Delete'}>Delete</button>
                    </td>
                  </tr>
                ))}
                {depts.length===0 && <tr><td colSpan={4} style={{textAlign:'center',padding:24,color:'var(--t3)'}}>None yet.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
