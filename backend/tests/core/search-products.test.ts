import { describe, expect, it } from 'vitest';
import type {
  ProductSearchRepository,
  SearchProductsQuery,
  SearchProductsResult,
} from '../../src/core/products/product-search-repository.port.js';
import {
  MAX_PAGE_SIZE,
  SearchProducts,
  SuggestProducts,
} from '../../src/core/products/search-products.js';

class SpySearchRepository implements ProductSearchRepository {
  lastQuery?: SearchProductsQuery;
  lastSuggest?: { prefix: string; limit: number };

  async search(query: SearchProductsQuery): Promise<SearchProductsResult> {
    this.lastQuery = query;
    return {
      hits: [],
      total: 0,
      page: query.page,
      size: query.size,
      tookMs: 0,
      facets: { brands: [], categories: [], price: null },
    };
  }

  async suggest(prefix: string, limit: number): Promise<string[]> {
    this.lastSuggest = { prefix, limit };
    return [];
  }
}

function query(overrides: Partial<SearchProductsQuery> = {}): SearchProductsQuery {
  return {
    q: '',
    brands: [],
    categories: [],
    inStockOnly: false,
    sort: 'relevance',
    page: 1,
    size: 24,
    ...overrides,
  };
}

describe('SearchProducts', () => {
  it('recorta los espacios del texto buscado', async () => {
    const repository = new SpySearchRepository();
    await new SearchProducts(repository).execute(query({ q: '  auriculares  ' }));

    expect(repository.lastQuery?.q).toBe('auriculares');
  });

  it('limita el tamaño de pagina al maximo permitido', async () => {
    const repository = new SpySearchRepository();
    await new SearchProducts(repository).execute(query({ size: 5000 }));

    expect(repository.lastQuery?.size).toBe(MAX_PAGE_SIZE);
  });

  it('nunca pide una pagina menor que la primera', async () => {
    const repository = new SpySearchRepository();
    await new SearchProducts(repository).execute(query({ page: -3 }));

    expect(repository.lastQuery?.page).toBe(1);
  });

  it('nunca pide un tamaño de pagina de cero', async () => {
    const repository = new SpySearchRepository();
    await new SearchProducts(repository).execute(query({ size: 0 }));

    expect(repository.lastQuery?.size).toBe(1);
  });

  it('deja pasar intactos los filtros de faceta', async () => {
    const repository = new SpySearchRepository();
    await new SearchProducts(repository).execute(
      query({ brands: ['Sony'], categories: ['Audio'], minPrice: 10, inStockOnly: true }),
    );

    expect(repository.lastQuery).toMatchObject({
      brands: ['Sony'],
      categories: ['Audio'],
      minPrice: 10,
      inStockOnly: true,
    });
  });
});

describe('SuggestProducts', () => {
  it('no consulta al motor con menos de dos caracteres', async () => {
    const repository = new SpySearchRepository();

    expect(await new SuggestProducts(repository).execute('a')).toEqual([]);
    expect(repository.lastSuggest).toBeUndefined();
  });

  it('ignora un prefijo que solo son espacios', async () => {
    const repository = new SpySearchRepository();

    expect(await new SuggestProducts(repository).execute('   ')).toEqual([]);
    expect(repository.lastSuggest).toBeUndefined();
  });

  it('acota el limite de sugerencias a 20', async () => {
    const repository = new SpySearchRepository();
    await new SuggestProducts(repository).execute('auri', 500);

    expect(repository.lastSuggest).toEqual({ prefix: 'auri', limit: 20 });
  });
});
