export interface User {
  id: string;
  email: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  sku: string;
  name: string;
  description: string;
  brand: string;
  category: string;
  price: number;
  currency: string;
  stock: number;
  rating: number;
  imageUrl: string | null;
  tags: string[];
  indexedAt: string;
  score: number;
  highlight?: { name?: string; description?: string };
}

export interface FacetBucket {
  value: string;
  count: number;
}

export interface SearchResult {
  hits: Product[];
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

export type SortOption = 'relevance' | 'price_asc' | 'price_desc' | 'rating_desc';

export interface SearchFilters {
  q: string;
  brands: string[];
  categories: string[];
  minPrice?: number;
  maxPrice?: number;
  inStockOnly: boolean;
  sort: SortOption;
  page: number;
}

export type UploadJobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface UploadJob {
  id: string;
  originalName: string;
  sizeBytes: number;
  status: UploadJobStatus;
  rowsTotal: number;
  rowsIndexed: number;
  rowsFailed: number;
  errors: { line: number; message: string }[];
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}
