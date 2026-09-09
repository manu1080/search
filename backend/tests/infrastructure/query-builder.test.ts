import { describe, expect, it } from 'vitest';
import type { SearchProductsQuery } from '../../src/core/products/product-search-repository.port.js';
import { buildSearchBody, buildSuggestBody } from '../../src/infrastructure/opensearch/query-builder.js';

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

describe('buildSearchBody', () => {
  it('usa match_all cuando no hay texto', () => {
    const body = buildSearchBody(query()) as any;

    expect(body.query.bool.must[0]).toEqual({ match_all: {} });
    expect(body.sort).toEqual([{ rating: 'desc' }]);
  });

  it('busca en varios campos con boost y tolerancia a erratas', () => {
    const body = buildSearchBody(query({ q: 'auriculares' })) as any;
    const match = body.query.bool.must[0].multi_match;

    expect(match.query).toBe('auriculares');
    expect(match.fields).toContain('name^4');
    expect(match.fuzziness).toBe('AUTO');
  });

  it('traduce las facetas a filtros de keyword', () => {
    const body = buildSearchBody(query({ brands: ['Sony', 'JBL'], categories: ['Audio'] })) as any;

    expect(body.query.bool.filter).toContainEqual({ terms: { 'brand.keyword': ['Sony', 'JBL'] } });
    expect(body.query.bool.filter).toContainEqual({ terms: { 'category.keyword': ['Audio'] } });
  });

  it('combina min y max de precio en un único range', () => {
    const body = buildSearchBody(query({ minPrice: 10, maxPrice: 50 })) as any;

    expect(body.query.bool.filter).toContainEqual({ range: { price: { gte: 10, lte: 50 } } });
  });

  it('acepta un rango de precio abierto por un extremo', () => {
    const body = buildSearchBody(query({ minPrice: 10 })) as any;

    expect(body.query.bool.filter).toContainEqual({ range: { price: { gte: 10 } } });
  });

  it('filtra por stock y valoración mínima', () => {
    const body = buildSearchBody(query({ inStockOnly: true, minRating: 4 })) as any;

    expect(body.query.bool.filter).toContainEqual({ range: { stock: { gt: 0 } } });
    expect(body.query.bool.filter).toContainEqual({ range: { rating: { gte: 4 } } });
  });

  it('calcula el offset a partir de la página', () => {
    expect((buildSearchBody(query({ page: 3, size: 20 })) as any).from).toBe(40);
  });

  it.each([
    ['price_asc', { price: 'asc' }],
    ['price_desc', { price: 'desc' }],
    ['rating_desc', { rating: 'desc' }],
  ] as const)('ordena por %s', (sort, expected) => {
    expect((buildSearchBody(query({ sort })) as any).sort[0]).toEqual(expected);
  });

  it('pide agregaciones de marca, categoría y precio', () => {
    const body = buildSearchBody(query()) as any;

    expect(Object.keys(body.aggs)).toEqual(['brands', 'categories', 'price_stats']);
  });
});

describe('buildSuggestBody', () => {
  it('no devuelve documentos, solo nombres agregados', () => {
    const body = buildSuggestBody('auri', 5) as any;

    expect(body.size).toBe(0);
    expect(body.query.match_phrase_prefix.name.query).toBe('auri');
    expect(body.aggs.names.terms.size).toBe(5);
  });
});
