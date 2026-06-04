import React, { useState, useEffect } from 'react';
import { userAPI, deptAPI, authAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import DeleteConfirmModal from '../../components/DeleteConfirmModal';

export default function AdminUsers() {
  const { user: me } = useAuth();
  const [users, setUsers]   = useState([]);
  const [depts, setDepts]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm]     = useState({ username:'', password:'', role:'department', dept_id:'', marker_role:null });
  const [editing, setEditing] = useState(null);
  const [error, setError]   = useState('');
  const [ok, setOk]         = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [u,d] = await Promise.all([userAPI.list(), deptAPI.list()]);
      setUsers(u?.data?.users || []);
      setDepts(d?.data?.departments || []);
    } catch (err) {
      console.error('Failed to load users/depts:', err);
      setUsers([]);
      setDepts([]);
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault(); setError(''); setOk('');
    try {
      const r = await userAPI.create(form);
      const newId = r.data.id;
      if (me?.role === 'admin') {
        try {
          await authAPI.logAdminActivity({
            action: 'Create User',
            target_type: 'user',
            target_id: newId,
            details: `Created user ${form.username} (${form.role})`,
          });
        } catch (logErr) {
          console.error('Admin activity log failed', logErr);
        }
      }
      setForm({username:'',password:'',role:'department',dept_id:'',marker_role:null});
      setOk('User created.');
      load();
    } catch (err) { setError(err.response?.data?.error || 'Failed.'); }
  };

  const update = async (e) => {
    e.preventDefault(); setError(''); setOk('');
    try {
      await userAPI.update(editing.id, editing);
      if (me?.role === 'admin') {
        try {
          await authAPI.logAdminActivity({
            action: 'Update User',
            target_type: 'user',
            target_id: editing.id,
            details: `Updated user ${editing.username} (${editing.role})`,
          });
        } catch (logErr) {
          console.error('Admin activity log failed', logErr);
        }
      }
      setEditing(null);
      setOk('User updated.');
      load();
    } catch (err) { setError(err.response?.data?.error || 'Failed.'); }
  };

  const del = async (u) => {
    setDeleteTarget(u);
  };

  const [deleteTarget, setDeleteTarget] = useState(null);

  const cancelDelete = () => setDeleteTarget(null);

  const confirmDelete = async (force = false) => {
    if (!deleteTarget) return;
    try {
      await userAPI.delete(deleteTarget.id, { force: force ? 1 : 0 });
      if (me?.role === 'admin') {
        try {
          await authAPI.logAdminActivity({
            action: 'Delete User',
            target_type: 'user',
            target_id: deleteTarget.id,
            details: `Deleted user ${deleteTarget.username}`,
          });
        } catch (logErr) {
          console.error('Admin activity log failed', logErr);
        }
      }
      setDeleteTarget(null);
      load();
    } catch (err) { alert(err.response?.data?.error||'Failed.'); }
  };

  const F = editing ? editing : form;
  const setF = editing ? (fn => setEditing(u => fn(u))) : (fn => setForm(u => fn(u)));

  return (
    <div className="g2" style={{ gap: 16 }}>
      <div className="card" style={{ alignSelf:'start', maxWidth: 380 }}>
        <div className="card-head">
          <span className="card-title">{editing ? '✏️ Edit User' : '👤 Create User'}</span>
          {editing && <button className="btn btn-outline btn-sm" onClick={() => setEditing(null)}>Cancel</button>}
        </div>
        <div className="card-body" style={{ padding: 16 }}>
          {error && <div className="alert a-err">{error}</div>}
          {ok    && <div className="alert a-ok">{ok}</div>}
          <form onSubmit={editing ? update : create}>
            <div className="fg" style={{ marginBottom: 12 }}><label className="lbl" style={{ fontSize: 13, marginBottom: 6 }}>Username</label>
              <input className="inp" style={{ fontSize: 13, padding: '9px 12px' }} required value={F.username} onChange={e=>setF(f=>({...f,username:e.target.value}))} /></div>
            <div className="fg" style={{ marginBottom: 12 }}><label className="lbl" style={{ fontSize: 13, marginBottom: 6 }}>Password {editing && <span className="muted" style={{ fontSize: 12 }}>(blank = keep)</span>}</label>
              <input className="inp" style={{ fontSize: 13, padding: '9px 12px' }} type="password" required={!editing} minLength={editing?0:6} value={F.password||''} onChange={e=>setF(f=>({...f,password:e.target.value}))} /></div>
            <div className="fg" style={{ marginBottom: 12 }}><label className="lbl" style={{ fontSize: 13, marginBottom: 6 }}>Role</label>
              <select className="sel" style={{ fontSize: 13, padding: '9px 12px' }} value={F.role} onChange={e=>setF(f=>({...f,role:e.target.value}))}>
                {F.role === 'pending' && <option value="pending">Pending</option>}
                <option value="department">Department</option>
                <option value="admin">Admin</option>
              </select></div>
            {(F.role !== 'admin') && (
              <>
                <div className="fg" style={{ marginBottom: 12 }}><label className="lbl" style={{ fontSize: 13, marginBottom: 6 }}>Department</label>
                  <select className="sel" style={{ fontSize: 13, padding: '9px 12px' }} value={F.dept_id||''} onChange={e=>setF(f=>({...f,dept_id:e.target.value}))}>
                    <option value="">-- None --</option>
                    {depts.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
                  </select></div>
                <div className="fg" style={{ marginBottom: 12 }}><label className="lbl" style={{ fontSize: 13, marginBottom: 6 }}>Marker Role</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className={`btn btn-sm ${F.marker_role === 'IN' ? 'btn-navy' : 'btn-outline'}`} onClick={() => setF(f => ({ ...f, marker_role: F.marker_role === 'IN' ? null : 'IN' }))} style={{ flex: 1, fontSize: 13, padding: '8px 0' }}>↓ IN (Entry)</button>
                    <button type="button" className={`btn btn-sm ${F.marker_role === 'OUT' ? 'btn-navy' : 'btn-outline'}`} onClick={() => setF(f => ({ ...f, marker_role: F.marker_role === 'OUT' ? null : 'OUT' }))} style={{ flex: 1, fontSize: 13, padding: '8px 0' }}>↑ OUT (Exit)</button>
                  </div></div>
              </>
            )}
            <button type="submit" className="btn btn-navy btn-full" style={{ padding: '10px 0', fontSize: 14 }}>{editing ? 'Save Changes' : 'Create User'}</button>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="card-title">All Users</span>
          <span className="badge b-none">{users && users.length ? users.length : 0}</span>
        </div>
        <div className="tbl-wrap">
          {loading ? <div style={{padding:24,textAlign:'center'}}><div className="spinner" style={{margin:'0 auto'}} /></div> : (
            <table style={{ fontSize: 13, borderCollapse: 'collapse' }}>
              <thead><tr><th style={{ padding: '10px 8px', fontSize: 13 }}>#</th><th style={{ padding: '10px 8px', fontSize: 13 }}>Username</th><th style={{ padding: '10px 8px', fontSize: 13 }}>Role</th><th style={{ padding: '10px 8px', fontSize: 13 }}>Department</th><th style={{ padding: '10px 8px', fontSize: 13 }}>Marker Role</th><th style={{ textAlign:'right', padding: '10px 8px', fontSize: 13 }}>Actions</th></tr></thead>
              <tbody>
                {users && users.length > 0 ? users.map(u=>(
                  <tr key={u.id}>
                    <td className="muted sm" style={{ padding: '10px 8px' }}>{u.id}</td>
                    <td style={{fontWeight:500, padding: '10px 8px'}}>{u.username}</td>
                    <td style={{ padding: '10px 8px' }}><span className={`badge ${u.role==='admin' ? 'b-admin' : u.role==='department' ? 'b-dept' : 'b-none'}`} style={{ fontSize: 12, padding: '2px 8px' }}>{u.role}</span></td>
                    <td className="muted" style={{ padding: '10px 8px' }}>{u.dept_name||'—'}</td>
                    <td style={{ padding: '10px 8px' }}>{u.marker_role ? <span style={{background:'var(--blue-bg)',color:'var(--blue)',padding:'2px 8px',borderRadius:'4px',fontSize:'11px',fontWeight:'600'}}>{u.marker_role}</span> : <span className="muted">—</span>}</td>
                    <td style={{textAlign:'right', padding: '10px 8px'}}>
                      <div className="row" style={{justifyContent:'flex-end',gap:4}}>
                        <button className="btn btn-outline btn-sm" style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => { setEditing({...u,password:''}); setError(''); setOk(''); }}>Edit</button>
                        {u.id !== me?.id && <button className="btn btn-red btn-sm" style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => del(u)}>Delete</button>}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="6" style={{textAlign:'center', padding:'20px', color:'var(--t3)'}}>No users found.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {deleteTarget && (
        <DeleteConfirmModal
          open={!!deleteTarget}
          subjectLabel="user"
          subjectName={deleteTarget.username}
          showForceOption={true}
          onCancel={cancelDelete}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}

