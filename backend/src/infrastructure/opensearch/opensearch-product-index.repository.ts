import type { Client } from '@opensearch-project/opensearch';
import type { Product } from '../../core/products/product.js';
import type {
  BulkIndexResult,
  ProductIndexRepository,
} from '../../core/products/product-index-repository.port.js';
import { productsIndexDefinition } from './products-index.js';

export class OpensearchProductIndexRepository implements ProductIndexRepository {
  private ensured = false;

  constructor(
    private readonly client: Client,
    private readonly index: string,
  ) {}

  /** Crea el indice si no existe. Idempotente y cacheado por proceso. */
  async ensureIndex(): Promise<void> {
    if (this.ensured) return;

    const exists = await this.client.indices.exists({ index: this.index });
    if (!exists.body) {
      await this.client.indices.create({
        index: this.index,
        body: productsIndexDefinition as unknown as Record<string, unknown>,
      });
    }
    this.ensured = true;
  }

  async bulkIndex(products: Product[]): Promise<BulkIndexResult> {
    if (products.length === 0) return { indexed: 0, failed: 0, errors: [] };

    // El _id es el sku: reprocesar el mismo CSV actualiza en vez de duplicar.
    const operations = products.flatMap((product) => [
      { index: { _index: this.index, _id: product.sku } },
      product,
    ]);

    const response = await this.client.bulk({ body: operations, refresh: false });
    const body = response.body as {
      errors: boolean;
      items: Array<{ index?: { status: number; error?: { reason?: string }; _id?: string } }>;
    };

    let indexed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const item of body.items) {
      const result = item.index;
      if (result && result.status < 300) {
        indexed += 1;
      } else {
        failed += 1;
        if (errors.length < 10) {
          errors.push(`sku ${result?._id ?? '?'}: ${result?.error?.reason ?? 'error al indexar'}`);
        }
      }
    }

    return { indexed, failed, errors };
  }

  async refresh(): Promise<void> {
    await this.client.indices.refresh({ index: this.index, ignore_unavailable: true });
  }
}
