import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LandingPage     from './pages/LandingPage';
import LoginPage       from './pages/LoginPage';
import AdminDashboard  from './pages/AdminDashboard';
import DeptDashboard   from './pages/DeptDashboard';
import PaperView       from './pages/PaperView';
import ScanRedirect from './pages/ScanRedirect';
import CaptureDocument from './pages/CaptureDocument';
import PublicDocumentView from './pages/PublicDocumentView';

function Guard({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading"><div className="spinner" /></div>;
  if (!user)   return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={user.role === 'admin' ? '/admin' : '/dept'} replace />;
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading"><div className="spinner" /></div>;
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LandingPage />} />
      <Route path="/auth" element={user ? <Navigate to={user.role === 'admin' ? '/admin' : '/dept'} /> : <LoginPage />} />
      <Route path="/document/:ref" element={<PublicDocumentView />} />
      <Route path="/admin/*" element={<Guard role="admin"><AdminDashboard /></Guard>} />
      <Route path="/dept/*"  element={<Guard role="department"><DeptDashboard /></Guard>} />
      <Route path="/paper/:id" element={<Guard><PaperView /></Guard>} />
      <Route path="/paper/:id/capture" element={<Guard><CaptureDocument /></Guard>} />  
      <Route path="/scan/:id" element={<Guard><ScanRedirect /></Guard>} />
      <Route path="*" element={<Navigate to={user ? (user.role === 'admin' ? '/admin' : '/dept') : '/'} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
