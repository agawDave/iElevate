import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ requireRole, nonAdminOnly }) {
  const { user, loading } = useAuth();

  if (loading) return null; // could render a splash/spinner here
  if (!user) return <Navigate to="/login" replace />;
  if (requireRole && user.role !== requireRole) return <Navigate to="/dashboard" replace />;
  if (nonAdminOnly && user.role === 'admin') return <Navigate to="/admin" replace />;

  return <Outlet />;
}
