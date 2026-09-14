import { createBrowserRouter } from 'react-router';
import { AppShell } from '../components/AppShell';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { ProfilePage } from '../features/profile/ProfilePage';
import { SearchPage } from '../features/search/SearchPage';
import { UploadPage } from '../features/uploads/UploadPage';

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <SearchPage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/registro', element: <RegisterPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: '/perfil', element: <ProfilePage /> },
          { path: '/subir', element: <UploadPage /> },
        ],
      },
      { path: '*', element: <SearchPage /> },
    ],
  },
]);
