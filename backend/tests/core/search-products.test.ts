import { describe, expect, it } from 'vitest';
import type {
  ProductSearchRepository,
  SearchProductsInput,
  SearchProductsQuery,
  SearchProductsResult,
} from '../../src/core/products/product-search-repository.port.js';
import {
  MAX_PAGE_SIZE,
  SearchProducts,
  SuggestProducts,
} from '../../src/core/products/search-products.js';

/** Repositorio de mentira que anota cada consulta y sirve totales a la carta. */
class SpySearchRepository implements ProductSearchRepository {
  readonly queries: SearchProductsQuery[] = [];
  lastSuggest?: { prefix: string; limit: number };

  /** Total que devuelve cada llamada, en orden. Por defecto, siempre 0. */
  constructor(private readonly totals: number[] = []) {}

  get lastQuery(): SearchProductsQuery | undefined {
    return this.queries.at(-1);
  }

  async search(query: SearchProductsQuery): Promise<SearchProductsResult> {
    this.queries.push(query);
    const total = this.totals[this.queries.length - 1] ?? 0;

    return {
      hits: [],
      total,
      page: query.page,
      size: query.size,
      tookMs: 0,
      typoTolerant: query.typoTolerant,
      facets: { brands: [], categories: [], price: null },
    };
  }

  async suggest(prefix: string, limit: number): Promise<string[]> {
    this.lastSuggest = { prefix, limit };
    return [];
  }
}

function input(overrides: Partial<SearchProductsInput> = {}): SearchProductsInput {
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

describe('SearchProducts: acotado de la consulta', () => {
  it('recorta los espacios del texto buscado', async () => {
    const repository = new SpySearchRepository([1]);
    await new SearchProducts(repository).execute(input({ q: '  auriculares  ' }));

    expect(repository.lastQuery?.q).toBe('auriculares');
  });

  it('limita el tamaño de página al máximo permitido', async () => {
    const repository = new SpySearchRepository([1]);
    await new SearchProducts(repository).execute(input({ size: 5000 }));

    expect(repository.lastQuery?.size).toBe(MAX_PAGE_SIZE);
  });

  it('nunca pide una página menor que la primera', async () => {
    const repository = new SpySearchRepository([1]);
    await new SearchProducts(repository).execute(input({ page: -3 }));

    expect(repository.lastQuery?.page).toBe(1);
  });

  it('nunca pide un tamaño de página de cero', async () => {
    const repository = new SpySearchRepository([1]);
    await new SearchProducts(repository).execute(input({ size: 0 }));

    expect(repository.lastQuery?.size).toBe(1);
  });

  it('deja pasar intactos los filtros de faceta', async () => {
    const repository = new SpySearchRepository([1]);
    await new SearchProducts(repository).execute(
      input({ q: 'x', brands: ['Sony'], categories: ['Audio'], minPrice: 10, inStockOnly: true }),
    );

    expect(repository.lastQuery).toMatchObject({
      brands: ['Sony'],
      categories: ['Audio'],
      minPrice: 10,
      inStockOnly: true,
    });
  });
});

describe('SearchProducts: erratas solo como último recurso', () => {
  it('busca primero sin tolerancia a erratas', async () => {
    const repository = new SpySearchRepository([3]);

    await new SearchProducts(repository).execute(input({ q: 'teclado' }));

    expect(repository.queries).toHaveLength(1);
    expect(repository.queries[0]?.typoTolerant).toBe(false);
  });

  it('no reintenta si la búsqueda precisa ya encontró algo', async () => {
    const repository = new SpySearchRepository([3]);

    const result = await new SearchProducts(repository).execute(input({ q: 'teclado' }));

    expect(repository.queries).toHaveLength(1);
    expect(result.total).toBe(3);
    expect(result.typoTolerant).toBe(false);
  });

  it('reintenta con tolerancia a erratas cuando no hay ni un resultado', async () => {
    const repository = new SpySearchRepository([0, 3]);

    const result = await new SearchProducts(repository).execute(input({ q: 'teclao' }));

    expect(repository.queries.map((query) => query.typoTolerant)).toEqual([false, true]);
    expect(result.total).toBe(3);
    expect(result.typoTolerant).toBe(true);
  });

  it('el reintento conserva filtros, orden y paginación', async () => {
    const repository = new SpySearchRepository([0, 1]);

    await new SearchProducts(repository).execute(
      input({ q: 'teclao', brands: ['Asus'], sort: 'price_asc', page: 2, size: 10 }),
    );

    expect(repository.queries[1]).toMatchObject({
      q: 'teclao',
      brands: ['Asus'],
      sort: 'price_asc',
      page: 2,
      size: 10,
      typoTolerant: true,
    });
  });

  it('no reintenta sin texto que corregir: daría lo mismo', async () => {
    const repository = new SpySearchRepository([0, 0]);

    await new SearchProducts(repository).execute(input({ q: '   ' }));

    expect(repository.queries).toHaveLength(1);
  });

  it('devuelve el resultado vacío del reintento si tampoco encuentra nada', async () => {
    const repository = new SpySearchRepository([0, 0]);

    const result = await new SearchProducts(repository).execute(input({ q: 'zzzzz' }));

    expect(repository.queries).toHaveLength(2);
    expect(result.total).toBe(0);
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

  it('acota el límite de sugerencias a 20', async () => {
    const repository = new SpySearchRepository();
    await new SuggestProducts(repository).execute('auri', 500);

    expect(repository.lastSuggest).toEqual({ prefix: 'auri', limit: 20 });
  });
});
