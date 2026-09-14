import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../../lib/api-client';
import type { SearchFilters, SearchResult } from '../../lib/types';

export const PAGE_SIZE = 24;

/**
 * A partir de aqui el backend busca tambien por prefijo. Con menos letras solo
 * habria coincidencias exactas, asi que la capa avisa en lugar de decir que no
 * hay resultados. Debe coincidir con MIN_PREFIX_LENGTH del query-builder.
 */
export const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 250;

export const emptyFilters: SearchFilters = {
  q: '',
  brands: [],
  categories: [],
  inStockOnly: false,
  sort: 'relevance',
  page: 1,
};

interface SearchState {
  result: SearchResult | null;
  loading: boolean;
  error: string | null;
}

/**
 * Busca con debounce y cancela la petición anterior, de modo que al teclear
 * rápido solo se pinta la respuesta de la última consulta. El estado de carga
 * se activa al lanzar la petición, no al teclear, para no parpadear entre
 * pulsaciones.
 */
export function useSearch(filters: SearchFilters): SearchState {
  const [state, setState] = useState<SearchState>({ result: null, loading: true, error: null });
  const latest = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const requestId = ++latest.current;

    const timer = setTimeout(() => {
      setState((current) => ({ ...current, loading: true, error: null }));

      api
        .search(filters, PAGE_SIZE, controller.signal)
        .then((result) => {
          if (requestId !== latest.current) return;
          setState({ result, loading: false, error: null });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted || requestId !== latest.current) return;
          setState({
            result: null,
            loading: false,
            error: error instanceof ApiError ? error.message : 'La búsqueda no esta disponible',
          });
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [filters]);

  return state;
}
