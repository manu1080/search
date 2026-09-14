import { Button, Separator, Switch } from '@heroui/react';
import { formatPrice } from '../../lib/format';
import type { FacetBucket, SearchFilters, SearchResult } from '../../lib/types';
import { Text } from '../../components/Text';

interface FacetPanelProps {
  facets: SearchResult['facets'];
  filters: SearchFilters;
  onChange: (patch: Partial<SearchFilters>) => void;
  onReset: () => void;
}

export function FacetPanel({ facets, filters, onChange, onReset }: FacetPanelProps) {
  const hasFilters =
    filters.brands.length > 0 ||
    filters.categories.length > 0 ||
    filters.inStockOnly ||
    filters.maxPrice !== undefined;
  return (
    <aside className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <Text className="font-semibold">Filtros</Text>
        {hasFilters && (
          <Button variant="ghost" size="sm" onPress={onReset}>
            Limpiar
          </Button>
        )}
      </div>
      <FacetGroup
        title="Categoría"
        buckets={facets.categories}
        selected={filters.categories}
        onToggle={(value) => onChange({ categories: toggle(filters.categories, value), page: 1 })}
      />
      <Separator />
      <FacetGroup
        title="Marca"
        buckets={facets.brands}
        selected={filters.brands}
        onToggle={(value) => onChange({ brands: toggle(filters.brands, value), page: 1 })}
      />
      {facets.price && facets.price.max > facets.price.min && (
        <>
          <Separator />
          <div className="flex flex-col gap-2">
            <Text size="sm" className="font-medium">
              Precio máximo
            </Text>
            <input
              type="range"
              className="w-full accent-accent"
              min={Math.floor(facets.price.min)}
              max={Math.ceil(facets.price.max)}
              value={filters.maxPrice ?? Math.ceil(facets.price.max)}
              aria-label="Precio máximo"
              onChange={(event) => onChange({ maxPrice: Number(event.target.value), page: 1 })}
            />
            <div className="flex justify-between text-xs text-muted">
              <span>{formatPrice(Math.floor(facets.price.min), 'EUR')}</span>
              <span className="font-medium text-foreground">
                {formatPrice(filters.maxPrice ?? Math.ceil(facets.price.max), 'EUR')}
              </span>
            </div>
          </div>
        </>
      )}
      <Separator />
      <Switch
        isSelected={filters.inStockOnly}
        onChange={(isSelected) => onChange({ inStockOnly: isSelected, page: 1 })}
      >
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          <Text size="sm">Solo con stock</Text>
        </Switch.Content>
      </Switch>
    </aside>
  );
}

interface FacetGroupProps {
  title: string;
  buckets: FacetBucket[];
  selected: string[];
  onToggle: (value: string) => void;
}

function FacetGroup({ title, buckets, selected, onToggle }: FacetGroupProps) {
  if (buckets.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <Text size="sm" className="font-medium">
        {title}
      </Text>
      <ul className="flex flex-col gap-1">
        {buckets.map((bucket) => {
          const isSelected = selected.includes(bucket.value);
          return (
            <li key={bucket.value}>
              <button
                type="button"
                aria-pressed={isSelected}
                onClick={() => onToggle(bucket.value)}
                className={[
                  'flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm transition-colors',
                  isSelected
                    ? 'bg-accent-soft text-accent-soft-foreground'
                    : 'text-muted hover:bg-surface-secondary hover:text-foreground',
                ].join(' ')}
              >
                <span className="truncate">{bucket.value}</span>
                <span className="ml-2 shrink-0 text-xs tabular-nums opacity-70">
                  {bucket.count}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function toggle(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}
