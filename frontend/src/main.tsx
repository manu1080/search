import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { router } from './app/router';
import { AuthProvider } from './features/auth/AuthProvider';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Falta el nodo #root en index.html');

createRoot(container).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
);
