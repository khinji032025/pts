import React, { useState, useEffect } from 'react';
import { userAPI, deptAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

export default function AdminUsers() {
  const { user: me } = useAuth();
  const [users, setUsers]   = useState([]);
  const [depts, setDepts]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm]     = useState({ username:'', password:'', role:'department', dept_id:'' });
  const [editing, setEditing] = useState(null);
  const [error, setError]   = useState('');
  const [ok, setOk]         = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [u,d] = await Promise.all([userAPI.list(), deptAPI.list()]);
      setUsers(u.data.users); setDepts(d.data.departments);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault(); setError(''); setOk('');
    try { await userAPI.create(form); setForm({username:'',password:'',role:'department',dept_id:''}); setOk('User created.'); load(); }
    catch (err) { setError(err.response?.data?.error || 'Failed.'); }
  };

  const update = async (e) => {
    e.preventDefault(); setError(''); setOk('');
    try { await userAPI.update(editing.id, editing); setEditing(null); setOk('User updated.'); load(); }
    catch (err) { setError(err.response?.data?.error || 'Failed.'); }
  };

  const del = async (u) => {
    if (!window.confirm(`Delete "${u.username}"?`)) return;
    try { await userAPI.delete(u.id); load(); }
    catch (err) { alert(err.response?.data?.error||'Failed.'); }
  };

  const F = editing ? editing : form;
  const setF = editing ? (fn => setEditing(u => fn(u))) : (fn => setForm(u => fn(u)));

  return (
    <div className="g2">
      <div className="card" style={{ alignSelf:'start' }}>
        <div className="card-head">
          <span className="card-title">{editing ? '✏️ Edit User' : '👤 Create User'}</span>
          {editing && <button className="btn btn-outline btn-sm" onClick={() => setEditing(null)}>Cancel</button>}
        </div>
        <div className="card-body">
          {error && <div className="alert a-err">{error}</div>}
          {ok    && <div className="alert a-ok">{ok}</div>}
          <form onSubmit={editing ? update : create}>
            <div className="fg"><label className="lbl">Username</label>
              <input className="inp" required value={F.username} onChange={e=>setF(f=>({...f,username:e.target.value}))} /></div>
            <div className="fg"><label className="lbl">Password {editing && <span className="muted">(blank = keep)</span>}</label>
              <input className="inp" type="password" required={!editing} minLength={editing?0:6} value={F.password||''} onChange={e=>setF(f=>({...f,password:e.target.value}))} /></div>
            <div className="fg"><label className="lbl">Role</label>
              <select className="sel" value={F.role} onChange={e=>setF(f=>({...f,role:e.target.value}))}>
                <option value="department">Department</option>
                <option value="admin">Admin</option>
              </select></div>
            {F.role==='department' && (
              <div className="fg"><label className="lbl">Department</label>
                <select className="sel" value={F.dept_id||''} onChange={e=>setF(f=>({...f,dept_id:e.target.value}))}>
                  <option value="">-- None --</option>
                  {depts.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
                </select></div>
            )}
            <button type="submit" className="btn btn-navy btn-full">{editing ? 'Save Changes' : 'Create User'}</button>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="card-title">All Users</span>
          <span className="badge b-none">{users.length}</span>
        </div>
        <div className="tbl-wrap">
          {loading ? <div style={{padding:32,textAlign:'center'}}><div className="spinner" style={{margin:'0 auto'}} /></div> : (
            <table>
              <thead><tr><th>#</th><th>Username</th><th>Role</th><th>Department</th><th style={{textAlign:'right'}}>Actions</th></tr></thead>
              <tbody>
                {users.map(u=>(
                  <tr key={u.id}>
                    <td className="muted sm">{u.id}</td>
                    <td style={{fontWeight:500}}>{u.username}</td>
                    <td><span className={`badge ${u.role==='admin'?'b-admin':'b-dept'}`}>{u.role}</span></td>
                    <td className="muted">{u.dept_name||'—'}</td>
                    <td style={{textAlign:'right'}}>
                      <div className="row" style={{justifyContent:'flex-end',gap:4}}>
                        <button className="btn btn-outline btn-sm" onClick={() => { setEditing({...u,password:''}); setError(''); setOk(''); }}>Edit</button>
                        {u.id !== me?.id && <button className="btn btn-red btn-sm" onClick={() => del(u)}>Del</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
