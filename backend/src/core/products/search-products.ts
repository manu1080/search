import type {
  ProductSearchRepository,
  SearchProductsQuery,
  SearchProductsResult,
} from './product-search-repository.port.js';

export const MAX_PAGE_SIZE = 60;

/**
 * Caso de uso de búsqueda. Acota página y tamaño antes de tocar el repositorio,
 * de forma que ningun cliente pueda pedir páginas absurdas al motor.
 */
export class SearchProducts {
  constructor(private readonly repository: ProductSearchRepository) {}

  execute(query: SearchProductsQuery): Promise<SearchProductsResult> {
    return this.repository.search({
      ...query,
      q: query.q.trim(),
      page: Math.max(1, query.page),
      size: Math.min(Math.max(1, query.size), MAX_PAGE_SIZE),
    });
  }
}

export class SuggestProducts {
  constructor(private readonly repository: ProductSearchRepository) {}

  async execute(prefix: string, limit = 8): Promise<string[]> {
    const clean = prefix.trim();
    if (clean.length < 2) return [];
    return this.repository.suggest(clean, Math.min(Math.max(1, limit), 20));
  }
}
