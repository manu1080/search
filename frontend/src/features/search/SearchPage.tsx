import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { SearchFilters } from '../../lib/types';
import { SearchView } from './SearchView';
import { emptyFilters } from './use-search';

/**
 * Página principal. Guarda los filtros y mantiene la consulta en la URL para
 * que cualquier búsqueda se pueda compartir por enlace.
 */
export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFilters] = useState<SearchFilters>(() => ({
    ...emptyFilters,
    q: searchParams.get('q') ?? '',
  }));

  const updateFilters = useCallback(
    (patch: Partial<SearchFilters>) => {
      setFilters((current) => ({ ...current, ...patch }));
      // La URL solo refleja el texto buscado, y solo cambia por acción directa
      // del usuario: sincronizarla dentro del updater actualizaría el router
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

  return <SearchView filters={filters} onChange={updateFilters} onReset={reset} />;
}
