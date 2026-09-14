import { Spinner } from '@heroui/react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../features/auth/auth-context';

export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="grid place-items-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  if (status === 'anonymous') {
    // Se recuerda el destino para volver alli después de iniciar sesión.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
