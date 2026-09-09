import type { Client } from '@opensearch-project/opensearch';
import type { ProductHit } from '../../core/products/product.js';
import type {
  FacetBucket,
  ProductSearchRepository,
  SearchProductsQuery,
  SearchProductsResult,
} from '../../core/products/product-search-repository.port.js';
import { buildSearchBody, buildSuggestBody } from './query-builder.js';

interface RawBucket {
  key: string;
  doc_count: number;
}

export class OpensearchProductSearchRepository implements ProductSearchRepository {
  constructor(
    private readonly client: Client,
    private readonly index: string,
  ) {}

  async search(query: SearchProductsQuery): Promise<SearchProductsResult> {
    const response = await this.client.search({
      index: this.index,
      body: buildSearchBody(query),
      ignore_unavailable: true,
    });

    const body = response.body as unknown as {
      took: number;
      hits: {
        total: { value: number } | number;
        hits: Array<{ _score: number | null; _source: ProductHit; highlight?: Record<string, string[]> }>;
      };
      aggregations?: {
        brands?: { buckets: RawBucket[] };
        categories?: { buckets: RawBucket[] };
        price_stats?: { min: number | null; max: number | null };
      };
    };

    const hits: ProductHit[] = body.hits.hits.map((hit) => ({
      ...hit._source,
      score: hit._score ?? 0,
      highlight: {
        ...(hit.highlight?.name?.[0] ? { name: hit.highlight.name[0] } : {}),
        ...(hit.highlight?.description?.[0] ? { description: hit.highlight.description[0] } : {}),
      },
    }));

    const stats = body.aggregations?.price_stats;

    return {
      hits,
      total: typeof body.hits.total === 'number' ? body.hits.total : body.hits.total.value,
      page: query.page,
      size: query.size,
      tookMs: body.took,
      typoTolerant: query.typoTolerant,
      facets: {
        brands: toFacets(body.aggregations?.brands?.buckets),
        categories: toFacets(body.aggregations?.categories?.buckets),
        price:
          stats && stats.min !== null && stats.max !== null
            ? { min: stats.min, max: stats.max }
            : null,
      },
    };
  }

  async suggest(prefix: string, limit: number): Promise<string[]> {
    const response = await this.client.search({
      index: this.index,
      body: buildSuggestBody(prefix, limit),
      ignore_unavailable: true,
    });

    const buckets =
      (response.body as unknown as { aggregations?: { names?: { buckets: RawBucket[] } } })
        .aggregations?.names
        ?.buckets ?? [];

    return buckets.map((bucket) => bucket.key);
  }
}

function toFacets(buckets: RawBucket[] | undefined): FacetBucket[] {
  return (buckets ?? []).map((bucket) => ({ value: bucket.key, count: bucket.doc_count }));
}
