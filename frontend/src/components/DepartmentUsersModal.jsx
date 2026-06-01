import React, { useEffect, useState } from 'react';
import { userAPI } from '../utils/api';

export default function DepartmentUsersModal({ dept_id, dept_name, onClose }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ username: '', password: '', marker_role: null });
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const r = await userAPI.list();
      const allUsers = r?.data?.users || [];
      console.log('All users from API:', allUsers);
      console.log('Filtering for dept_id:', dept_id);
      const filteredUsers = allUsers.filter(u => {
        const userDeptId = u.department_id ? String(u.department_id) : '';
        const targetDeptId = String(dept_id);
        console.log(`User ${u.username}: dept_id=${userDeptId}, comparing with ${targetDeptId}, match=${userDeptId === targetDeptId}`);
        return userDeptId === targetDeptId;
      });
      console.log('Filtered users:', filteredUsers);
      setUsers(filteredUsers);
    } catch (err) {
      console.error('Failed to load users:', err);
      setError(err?.response?.data?.error || 'Failed to load users.');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [dept_id]);

  const resetForm = () => {
    setForm({ username: '', password: '', marker_role: null });
    setEditing(null);
  };

  const save = async (e) => {
    e.preventDefault();
    setError('');
    setOk('');
    try {
      if (editing) {
        await userAPI.update(editing.id, { ...editing, role: 'department', dept_id, password: editing.password || '', marker_role: editing.marker_role || null });
        setOk('User updated.');
      } else {
        await userAPI.create({ username: form.username, password: form.password, role: 'department', dept_id, marker_role: form.marker_role || null });
        setOk('User created.');
      }
      resetForm();
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed.');
    }
  };

  const del = async (u) => {
    if (!window.confirm(`Delete "${u.username}"?`)) return;
    try {
      await userAPI.delete(u.id);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed.');
    }
  };

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 820 }}>
        <div className="modal-head">
          <span className="modal-title">👥 Manage {dept_name} Users</span>
          <button className="btn btn-outline btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="alert a-err">{error}</div>}
          {ok && <div className="alert a-ok">{ok}</div>}
          <div className="g2">
            <form className="card" style={{ alignSelf: 'start' }} onSubmit={save}>
              <div className="card-head">
                <span className="card-title">{editing ? '✏️ Edit User' : '➕ Add User'}</span>
                {editing && <button type="button" className="btn btn-outline btn-sm" onClick={resetForm}>Cancel</button>}
              </div>
              <div className="card-body">
                <div className="fg">
                  <label className="lbl">Username</label>
                  <input
                    className="inp"
                    required
                    value={editing ? editing.username : form.username}
                    onChange={e => editing ? setEditing(v => ({ ...v, username: e.target.value })) : setForm(v => ({ ...v, username: e.target.value }))}
                  />
                </div>
                <div className="fg">
                  <label className="lbl">Password {editing && <span className="muted">(blank = keep)</span>}</label>
                  <input
                    className="inp"
                    type="password"
                    required={!editing}
                    minLength={editing ? 0 : 6}
                    value={editing ? (editing.password || '') : form.password}
                    onChange={e => editing ? setEditing(v => ({ ...v, password: e.target.value })) : setForm(v => ({ ...v, password: e.target.value }))}
                  />
                </div>
                <div className="fg">
                  <label className="lbl">Marker Role</label>
                  <select 
                    className="sel"
                    value={editing ? (editing.marker_role || '') : (form.marker_role || '')}
                    onChange={e => editing ? setEditing(v => ({ ...v, marker_role: e.target.value || null })) : setForm(v => ({ ...v, marker_role: e.target.value || null }))}
                  >
                    <option value="">-- None --</option>
                    <option value="IN">IN (Entry Marker)</option>
                    <option value="OUT">OUT (Exit Marker)</option>
                  </select>
                </div>
                <button type="submit" className="btn btn-navy btn-full">{editing ? 'Save Changes' : 'Create User'}</button>
              </div>
            </form>

            <div className="card">
              <div className="card-head">
                <span className="card-title">Department Users</span>
                <span className="badge b-none">{users && users.length ? users.length : 0}</span>
              </div>
              <div className="tbl-wrap">
                {loading ? (
                  <div style={{ padding: 32, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
                ) : users && users.length > 0 ? (
                  <table>
                    <thead><tr><th>Username</th><th>Marker Role</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id}>
                          <td style={{ fontWeight: 500 }}>{u.username}</td>
                          <td>{u.marker_role ? <span style={{background:'var(--blue-bg)',color:'var(--blue)',padding:'2px 8px',borderRadius:'4px',fontSize:'11px',fontWeight:'600'}}>{u.marker_role}</span> : <span className="muted">—</span>}</td>
                          <td style={{ textAlign: 'right' }}>
                            <div className="row" style={{ justifyContent: 'flex-end', gap: 4 }}>
                              <button type="button" className="btn btn-outline btn-sm" onClick={() => { setEditing({ ...u, password: '' }); setError(''); setOk(''); }}>Edit</button>
                              <button type="button" className="btn btn-red btn-sm" onClick={() => del(u)}>Del</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ padding: '32px', textAlign: 'center', color: 'var(--t3)' }}>No users found.</div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-outline" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}