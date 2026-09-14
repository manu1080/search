import type { ProductHit } from './product.js';

export type ProductSort = 'relevance' | 'price_asc' | 'price_desc' | 'rating_desc';

export interface SearchProductsQuery {
  q: string;
  brands: string[];
  categories: string[];
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  inStockOnly: boolean;
  sort: ProductSort;
  page: number;
  size: number;
  /**
   * Si se admiten erratas. Lo decide el caso de uso, no quien llama: primero se
   * busca sin tolerancia y solo se reintenta con ella si no hubo resultados.
   */
  typoTolerant: boolean;
}

/** Lo que pide quien consulta; la tolerancia a erratas la gobierna el caso de uso. */
export type SearchProductsInput = Omit<SearchProductsQuery, 'typoTolerant'>;

export interface FacetBucket {
  value: string;
  count: number;
}

export interface SearchProductsResult {
  hits: ProductHit[];
  total: number;
  page: number;
  size: number;
  tookMs: number;
  /** true si estos resultados salieron del reintento tolerante a erratas. */
  typoTolerant: boolean;
  facets: {
    brands: FacetBucket[];
    categories: FacetBucket[];
    price: { min: number; max: number } | null;
  };
}

export interface ProductSearchRepository {
  search(query: SearchProductsQuery): Promise<SearchProductsResult>;
  suggest(prefix: string, limit: number): Promise<string[]>;
}
