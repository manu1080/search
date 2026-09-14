import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, tokenStorage } from '../../lib/api-client';
import type { User } from '../../lib/types';
import { AuthContext, type AuthState } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // Sin token no hay nada que validar: se arranca ya como anonimo.
  const [status, setStatus] = useState<AuthState['status']>(() =>
    tokenStorage.get() ? 'loading' : 'anonymous',
  );

  // Al arrancar se valida el token guardado: si caduco, la sesión se descarta.
  useEffect(() => {
    if (!tokenStorage.get()) return;

    let cancelled = false;
    api
      .me()
      .then(({ user: current }) => {
        if (cancelled) return;
        setUser(current);
        setStatus('authenticated');
      })
      .catch(() => {
        if (cancelled) return;
        tokenStorage.clear();
        setStatus('anonymous');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.login(email, password);
    tokenStorage.set(result.token);
    setUser(result.user);
    setStatus('authenticated');
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const result = await api.register(name, email, password);
    tokenStorage.set(result.token);
    setUser(result.user);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(() => {
    tokenStorage.clear();
    setUser(null);
    setStatus('anonymous');
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, status, login, register, logout, setUser }),
    [user, status, login, register, logout],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
