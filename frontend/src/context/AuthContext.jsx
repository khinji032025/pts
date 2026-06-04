import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../utils/api';

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authAPI.session()
      .then(r => { if (r.data.auth) setUser(r.data.user); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const login = async (username, password) => {
    const r = await authAPI.login({ username, password });
    setUser(r.data.user);
    return r.data.user;
  };

  const googleLogin = async (id_token) => {
    const r = await authAPI.googleLogin({ id_token });
    if (r.data.user) {
      setUser(r.data.user);
      return { user: r.data.user };
    }
    return { message: r.data.message || 'Google sign-in completed.' };
  };

  const qrLogin = async (dept_id) => {
    const r = await authAPI.qrLogin({ dept_id });
    setUser(r.data.user);
    return r.data.user;
  };

  const logout = async () => {
    await authAPI.logout();
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, loading, login, googleLogin, qrLogin, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
