import { Button, ListBox, SearchField, Select, Skeleton, Spinner } from '@heroui/react';
import { useEffect, useRef } from 'react';
import { StatusMessage } from '../../components/StatusMessage';
import type { SearchFilters, SortOption } from '../../lib/types';
import { FacetPanel } from './FacetPanel';
import { ProductCard } from './ProductCard';
import { MIN_QUERY_LENGTH, PAGE_SIZE, useSearch } from './use-search';
import { Text, Title } from '../../components/Text';

const SORT_LABELS: Record<SortOption, string> = {
  relevance: 'Relevancia',
  price_asc: 'Precio: menor a mayor',
  price_desc: 'Precio: mayor a menor',
  rating_desc: 'Mejor valorados',
};

interface SearchLayerProps {
  filters: SearchFilters;
  onChange: (patch: Partial<SearchFilters>) => void;
  onReset: () => void;
  onClose: () => void;
}

/**
 * Capa de resultados a pantalla completa. Mantiene el buscador dentro de la
 * capa para que el foco nunca salte fuera mientras se teclea.
 */
export function SearchLayer({ filters, onChange, onReset, onClose }: SearchLayerProps) {
  const { result, loading, error } = useSearch(filters);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      // Si hay un desplegable abierto (el de orden), Escape es suyo: solo debe
      // cerrarlo a el.
      if (document.querySelector('[role="listbox"]')) return;

      // Dentro del buscador con texto, Escape lo vacia; la capa se cierra a la
      // segunda pulsacion, ya con el campo vacio.
      const target = event.target;
      if (target instanceof HTMLInputElement && target.type === 'search' && target.value !== '') {
        return;
      }

      onClose();
    };

    // En fase de captura: el campo de busqueda de react-aria consume Escape
    // para vaciarse y detiene la propagacion, asi que un listener normal en
    // document nunca llegaria a ejecutarse.
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;
  const consultaCorta = filters.q.length > 0 && filters.q.length < MIN_QUERY_LENGTH;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Resultados de búsqueda"
      className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-xl"
    >
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4">
          <SearchField
            className="flex-1"
            value={filters.q}
            onChange={(value) => onChange({ q: value, page: 1 })}
            aria-label="Buscar productos"
          >
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input
                ref={inputRef}
                placeholder="Busca por nombre, marca o categoría…"
              />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <Button variant="ghost" onPress={onClose}>
            Cerrar
          </Button>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-6 lg:grid-cols-[220px_1fr]">
          <div className="hidden lg:block">
            {result && (
              <FacetPanel
                facets={result.facets}
                filters={filters}
                onChange={onChange}
                onReset={onReset}
              />
            )}
          </div>
          <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Text size="sm" tone="muted" aria-live="polite">
                {loading && !result
                  ? 'Buscando…'
                  : result
                    ? `${result.total} ${result.total === 1 ? 'producto' : 'productos'} · ${result.tookMs} ms`
                    : ''}
              </Text>
              <Select
                selectedKey={filters.sort}
                aria-label="Ordenar resultados"
                onSelectionChange={(key) => onChange({ sort: key as SortOption, page: 1 })}
              >
                <Select.Trigger className="w-56">
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {Object.entries(SORT_LABELS).map(([value, label]) => (
                      <ListBox.Item key={value} id={value} textValue={label}>
                        {label}
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>
            {error && <StatusMessage tone="danger">{error}</StatusMessage>}
            {loading && !result && <ResultsSkeleton />}
            {result && result.hits.length === 0 && !loading && (
              <div className="grid place-items-center gap-2 rounded-xl border border-dashed border-border py-20 text-center">
                {consultaCorta ? (
                  <>
                    <Title level="h5">Sigue escribiendo…</Title>
                    <Text size="sm" tone="muted">
                      Con {MIN_QUERY_LENGTH} letras o más buscamos también por el principio de la
                      palabra.
                    </Text>
                  </>
                ) : (
                  <>
                    <Title level="h5">Sin resultados</Title>
                    <Text size="sm" tone="muted">
                      Prueba con otras palabras o quita algún filtro.
                    </Text>
                    <Button variant="secondary" size="sm" onPress={onReset}>
                      Limpiar filtros
                    </Button>
                  </>
                )}
              </div>
            )}
            {result && result.hits.length > 0 && (
              <div
                className={[
                  'grid gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-3',
                  loading ? 'opacity-60' : 'opacity-100',
                ].join(' ')}
              >
                {result.hits.map((product) => (
                  <ProductCard key={product.sku} product={product} />
                ))}
              </div>
            )}
            {result && totalPages > 1 && (
              <nav className="flex items-center justify-center gap-3 py-4">
                <Button
                  variant="outline"
                  size="sm"
                  isDisabled={filters.page <= 1}
                  onPress={() => onChange({ page: filters.page - 1 })}
                >
                  Anterior
                </Button>
                <Text size="sm" tone="muted">
                  Página {filters.page} de {totalPages}
                </Text>
                <Button
                  variant="outline"
                  size="sm"
                  isDisabled={filters.page >= totalPages}
                  onPress={() => onChange({ page: filters.page + 1 })}
                >
                  Siguiente
                </Button>
              </nav>
            )}
            {loading && result && (
              <div className="pointer-events-none fixed bottom-6 right-6">
                <Spinner size="sm" />
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-80 w-full rounded-xl" />
      ))}
    </div>
  );
}
