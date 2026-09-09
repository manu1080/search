import { Avatar, Button } from '@heroui/react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { useAuth } from '../features/auth/auth-context';
import { initials } from '../lib/initials';
import { ThemeToggle } from './ThemeToggle';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-surface-secondary text-foreground'
      : 'text-muted hover:bg-surface-secondary hover:text-foreground',
  ].join(' ');

export function AppShell() {
  const { user, status, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <NavLink to="/" className="flex items-center gap-2 font-semibold">
            <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-foreground">
              <svg
                viewBox="0 0 24 24"
                className="size-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" strokeLinecap="round" />
              </svg>
            </span>
            <span className="hidden sm:inline">Buscador</span>
          </NavLink>

          <nav className="flex items-center gap-1">
            <NavLink to="/" className={navLinkClass} end>
              Buscar
            </NavLink>
            {status === 'authenticated' && (
              <>
                <NavLink to="/subir" className={navLinkClass}>
                  Subir CSV
                </NavLink>
                <NavLink to="/perfil" className={navLinkClass}>
                  Perfil
                </NavLink>
              </>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            {status === 'authenticated' && user ? (
              <div className="flex items-center gap-2">
                <NavLink to="/perfil" aria-label="Ir a mi perfil">
                  <Avatar size="sm">
                    {user.avatarUrl && <Avatar.Image src={user.avatarUrl} alt={user.name} />}
                    <Avatar.Fallback>{initials(user.name)}</Avatar.Fallback>
                  </Avatar>
                </NavLink>
                <Button variant="ghost" size="sm" onPress={logout}>
                  Salir
                </Button>
              </div>
            ) : (
              status === 'anonymous' && (
                <Button size="sm" variant="primary" onPress={() => void navigate('/login')}>
                  Entrar
                </Button>
              )
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
