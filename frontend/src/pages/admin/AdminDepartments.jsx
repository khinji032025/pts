import React, { useState, useEffect } from 'react';
import { deptAPI } from '../../utils/api';

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
    try { await deptAPI.create({ name }); setName(''); setOk(`"${name}" added.`); load(); }
    catch (err) { setError(err.response?.data?.error || 'Failed.'); }
  };

  const del = async (d) => {
    if (!window.confirm(`Delete "${d.name}"?`)) return;
    try { await deptAPI.delete(d.id); load(); }
    catch (err) { alert(err.response?.data?.error || 'Failed.'); }
  };

  return (
    <div className="g2">
      <div className="card" style={{ alignSelf:'start' }}>
        <div className="card-head"><span className="card-title">🏢 Add Department</span></div>
        <div className="card-body">
          {error && <div className="alert a-err">{error}</div>}
          {ok    && <div className="alert a-ok">{ok}</div>}
          <form onSubmit={add}>
            <div className="fg"><label className="lbl">Department Name</label>
              <input className="inp" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Budget Office" required /></div>
            <button type="submit" className="btn btn-navy btn-full">Add Department</button>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="card-title">All Departments</span>
          <span className="badge b-none">{depts.length}</span>
        </div>
        <div className="tbl-wrap">
          {loading ? <div style={{padding:32,textAlign:'center'}}><div className="spinner" style={{margin:'0 auto'}} /></div> : (
            <table>
              <thead><tr><th>#</th><th>Name</th><th>Users</th><th style={{textAlign:'right'}}>Actions</th></tr></thead>
              <tbody>
                {depts.map(d => (
                  <tr key={d.id}>
                    <td className="muted sm">{d.id}</td>
                    <td style={{fontWeight:500}}>{d.name}</td>
                    <td><span className="badge b-none">{d.user_count}</span></td>
                    <td style={{textAlign:'right'}}>
                      <button className="btn btn-red btn-sm" onClick={() => del(d)} disabled={d.user_count>0} title={d.user_count>0?'Has users':'Delete'}>Delete</button>
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
