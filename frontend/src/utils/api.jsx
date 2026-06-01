import axios from 'axios';

const BASE = '/pts/backend/modules';

const api = axios.create({
  baseURL: BASE,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

export const authAPI = {
  login:          (d) => api.post('/auth.php?action=login', d),
  logout:         ()  => api.post('/auth.php?action=logout'),
  session:        ()  => api.get('/auth.php?action=session'),
  changePassword: (d) => api.post('/auth.php?action=change_password', d),
  qrLogin:        (d) => api.post('/auth.php?action=qr_login', d),
  loginHistory:   ()  => api.get('/auth.php?action=login_history'),
  adminActivityHistory: () => api.get('/auth.php?action=admin_activity_history'),
  logAdminActivity: (d) => api.post('/auth.php?action=admin_activity_log', d),
};

export const deptAPI = {
  list:   ()    => api.get('/departments.php?action=list'),
  create: (d)   => api.post('/departments.php?action=create', d),
  delete: (id)  => api.delete(`/departments.php?action=delete&id=${id}`),
};

export const userAPI = {
  list:   ()        => api.get('/users.php?action=list'),
  create: (d)       => api.post('/users.php?action=create', d),
  update: (id, d)   => api.put(`/users.php?action=update&id=${id}`, d),
  delete: (id)      => api.delete(`/users.php?action=delete&id=${id}`),
};

export const paperAPI = {
  list:        (p)      => api.get('/papers.php?action=list', { params: p }),
  view:        (id)     => api.get(`/papers.php?action=view&id=${id}`),
  publicView:  (ref)    => api.get(`/papers.php?action=public_view&ref=${ref}`),
  create:      (d)      => api.post('/papers.php?action=create', d),
  delete:      (id)     => api.delete(`/papers.php?action=delete&id=${id}`),
  mark:        (d)      => api.post('/papers.php?action=mark', d),
  editLog:     (id, d)  => api.put(`/papers.php?action=edit_log&id=${id}`, d),
  undoMark:    (paper_id) => api.post(`/papers.php?action=undo_mark&paper_id=${paper_id}`),
  deleteImage: (id)     => api.delete(`/papers.php?action=delete_image&id=${id}`),
  scan:        (ref, params = {}) => api.get('/papers.php?action=scan', { params: { ref, ...params } }),
  uploadImage: (fd)     => api.post('/papers.php?action=upload_image', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

export const notificationsAPI = {
  list: () => api.get('/notifications.php?action=list'),
  markRead: (d) => api.post('/notifications.php?action=mark_read', d),
  markAllRead: () => api.post('/notifications.php?action=mark_all_read'),
};

export default api;
