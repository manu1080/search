import { Button, ListBox, SearchField, Select, Skeleton, Spinner } from '@heroui/react';
import { useEffect, useRef } from 'react';
import { StatusMessage } from '../../components/StatusMessage';
import { Text, Title } from '../../components/Text';
import type { SearchFilters, SortOption } from '../../lib/types';
import { FacetPanel } from './FacetPanel';
import { ProductCard } from './ProductCard';
import { MIN_QUERY_LENGTH, PAGE_SIZE, useSearch } from './use-search';

const SORT_LABELS: Record<SortOption, string> = {
  relevance: 'Relevancia',
  price_asc: 'Precio: menor a mayor',
  price_desc: 'Precio: mayor a menor',
  rating_desc: 'Mejor valorados',
};

interface SearchViewProps {
  filters: SearchFilters;
  onChange: (patch: Partial<SearchFilters>) => void;
  onReset: () => void;
}

/**
 * Vista principal de la aplicación: el buscador y sus resultados. No es una
 * capa ni una ventana aparte, es la propia página, así que escribir en la barra
 * no lleva a ningún sitio: los resultados se actualizan donde están.
 */
export function SearchView({ filters, onChange, onReset }: SearchViewProps) {
  const { result, loading, error } = useSearch(filters);
  const inputRef = useRef<HTMLInputElement>(null);

  // El buscador es el motivo de la página: se le da el foco al entrar.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;
  const consultaCorta = filters.q.length > 0 && filters.q.length < MIN_QUERY_LENGTH;

  function irAPagina(page: number) {
    onChange({ page });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="flex flex-col">
      {/* Pegado bajo la cabecera: el buscador sigue a mano al recorrer resultados.
          El margen negativo anula el relleno superior del <main> para que quede
          a ras de la cabecera desde el principio y no salte al hacer scroll. */}
      <div className="sticky top-16 z-30 -mx-4 -mt-8 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-md">
        <SearchField
          className="mx-auto w-full max-w-3xl"
          value={filters.q}
          onChange={(value) => onChange({ q: value, page: 1 })}
          aria-label="Buscar productos"
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input ref={inputRef} placeholder="Busca por nombre, marca o categoría…" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
      </div>

      <div className="grid gap-8 py-6 lg:grid-cols-[220px_1fr]">
        <div className="hidden lg:block">
          {result && (
            <div className="sticky top-36">
              <FacetPanel
                facets={result.facets}
                filters={filters}
                onChange={onChange}
                onReset={onReset}
              />
            </div>
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

          {result && result.typoTolerant && result.total > 0 && (
            <p
              role="status"
              className="rounded-lg border border-border bg-surface-secondary px-3 py-2 text-sm text-muted"
            >
              No hay coincidencias exactas con «{filters.q}». Esto es lo más parecido.
            </p>
          )}

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
                onPress={() => irAPagina(filters.page - 1)}
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
                onPress={() => irAPagina(filters.page + 1)}
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
