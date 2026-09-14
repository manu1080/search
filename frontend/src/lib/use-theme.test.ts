import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTheme } from './use-theme';

function stubPrefersDark(prefersDark: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: prefersDark,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = '';
  delete document.documentElement.dataset.theme;
  stubPrefersDark(false);
});

describe('useTheme', () => {
  it('arranca en claro si el sistema no pide oscuro', () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('sigue la preferencia del sistema cuando no hay nada guardado', () => {
    stubPrefersDark(true);

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('el tema guardado manda sobre la preferencia del sistema', () => {
    localStorage.setItem('theme', 'light');
    stubPrefersDark(true);

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('light');
  });

  it('alterna entre claro y oscuro', () => {
    const { result } = renderHook(() => useTheme());

    act(() => result.current.toggle());
    expect(result.current.theme).toBe('dark');

    act(() => result.current.toggle());
    expect(result.current.theme).toBe('light');
  });

  it('escribe la clase y el data-theme que espera HeroUI', () => {
    const { result } = renderHook(() => useTheme());

    act(() => result.current.setTheme('dark'));

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('persiste la eleccion para la siguiente visita', () => {
    const { result } = renderHook(() => useTheme());

    act(() => result.current.setTheme('dark'));

    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('ignora un valor guardado que no es un tema valido', () => {
    localStorage.setItem('theme', 'fucsia');

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('light');
  });
});
