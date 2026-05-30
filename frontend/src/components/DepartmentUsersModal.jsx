import React, { useEffect, useState } from 'react';
import { userAPI } from '../utils/api';

export default function DepartmentUsersModal({ dept_id, dept_name, onClose }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ username: '', password: '' });
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await userAPI.list();
      setUsers((r.data.users || []).filter(u => String(u.department_id || '') === String(dept_id)));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [dept_id]);

  const resetForm = () => {
    setForm({ username: '', password: '' });
    setEditing(null);
  };

  const save = async (e) => {
    e.preventDefault();
    setError('');
    setOk('');
    try {
      if (editing) {
        await userAPI.update(editing.id, { ...editing, role: 'department', dept_id, password: editing.password || '' });
        setOk('User updated.');
      } else {
        await userAPI.create({ username: form.username, password: form.password, role: 'department', dept_id });
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
                <button type="submit" className="btn btn-navy btn-full">{editing ? 'Save Changes' : 'Create User'}</button>
              </div>
            </form>

            <div className="card">
              <div className="card-head">
                <span className="card-title">Department Users</span>
                <span className="badge b-none">{users.length}</span>
              </div>
              <div className="tbl-wrap">
                {loading ? (
                  <div style={{ padding: 32, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
                ) : (
                  <table>
                    <thead><tr><th>Username</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id}>
                          <td style={{ fontWeight: 500 }}>{u.username}</td>
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