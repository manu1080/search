import type { Product } from './product.js';

export interface BulkIndexResult {
  indexed: number;
  failed: number;
  errors: string[];
}

export interface ProductIndexRepository {
  ensureIndex(): Promise<void>;
  bulkIndex(products: Product[]): Promise<BulkIndexResult>;
  refresh(): Promise<void>;
}
