import { Chip } from '@heroui/react';
import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { SearchFilters } from '../../lib/types';
import { SearchLayer } from './SearchLayer';
import { emptyFilters } from './use-search';
import { Text, Title } from '../../components/Text';

const SUGGESTED = ['Auriculares', 'Portátil', 'Cafetera', 'Zapatillas', 'Cámara', 'Smartwatch'];

export function SearchPage() {
  // La consulta vive en la URL: los resultados se pueden compartir por enlace.
  const [searchParams, setSearchParams] = useSearchParams();
  const [isOpen, setIsOpen] = useState(() => searchParams.has('q'));
  const [filters, setFilters] = useState<SearchFilters>(() => ({
    ...emptyFilters,
    q: searchParams.get('q') ?? '',
  }));
  const updateFilters = useCallback(
    (patch: Partial<SearchFilters>) => {
      setFilters((current) => ({ ...current, ...patch }));
      // La URL solo refleja el texto buscado, y solo cambia por acción directa
      // del usuario: sincronizarla dentro del updater actualizaria el router
      // durante el render.
      if (patch.q !== undefined) {
        setSearchParams(patch.q ? { q: patch.q } : {}, { replace: true });
      }
    },
    [setSearchParams],
  );
  const reset = useCallback(() => {
    setFilters((current) => ({ ...emptyFilters, q: current.q }));
  }, []);
  const close = useCallback(() => {
    setIsOpen(false);
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);
  const open = useCallback(
    (query = '') => {
      updateFilters({ ...emptyFilters, q: query });
      setIsOpen(true);
    },
    [updateFilters],
  );
  const layer = useMemo(
    () =>
      isOpen ? (
        <SearchLayer filters={filters} onChange={updateFilters} onReset={reset} onClose={close} />
      ) : null,
    [isOpen, filters, updateFilters, reset, close],
  );
  return (
    <>
      <section className="flex flex-col items-center gap-8 py-16 text-center">
        <div className="flex flex-col items-center gap-3">
          <Chip variant="soft" color="accent" size="sm">
            <Chip.Label>Búsqueda abierta · sin registro</Chip.Label>
          </Chip>
          <Title level="h1" className="max-w-2xl text-balance">
            Encuentra cualquier producto del catálogo
          </Title>
          <Text tone="muted" className="max-w-xl text-balance">
            Búsqueda por texto completo sobre OpenSearch, con filtros por marca, categoría y precio.
          </Text>
        </div>
        <button
          type="button"
          onClick={() => open()}
          className="group flex w-full max-w-xl items-center gap-3 rounded-2xl border border-border bg-field px-5 py-4 text-left shadow-sm transition-all hover:border-field-border-hover hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <svg
            viewBox="0 0 24 24"
            className="size-5 text-muted"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <span className="flex-1 text-field-placeholder">
            Busca por nombre, marca o categoría…
          </span>
          <kbd className="hidden rounded-md border border-border px-2 py-1 text-xs text-muted sm:block">
            Buscar
          </kbd>
        </button>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Text size="sm" tone="muted">
            Prueba con:
          </Text>
          {SUGGESTED.map((term) => (
            <button
              key={term}
              type="button"
              onClick={() => open(term)}
              className="rounded-full border border-border px-3 py-1 text-sm text-muted transition-colors hover:border-accent hover:text-foreground"
            >
              {term}
            </button>
          ))}
        </div>
      </section>
      {layer}
    </>
  );
}
