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
}

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
