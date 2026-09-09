import { describe, expect, it } from 'vitest';
import type { SearchProductsQuery } from '../../src/core/products/product-search-repository.port.js';
import {
  buildSearchBody,
  buildSuggestBody,
  MIN_PREFIX_LENGTH,
} from '../../src/infrastructure/opensearch/query-builder.js';

function query(overrides: Partial<SearchProductsQuery> = {}): SearchProductsQuery {
  return {
    q: '',
    brands: [],
    categories: [],
    inStockOnly: false,
    sort: 'relevance',
    page: 1,
    size: 24,
    typoTolerant: true,
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
    const match = clausulas(buildSearchBody(query({ q: 'auriculares' }))).conErratas;

    expect(match.query).toBe('auriculares');
    expect(match.fields).toContain('name^4');
    expect(match.fuzziness).toBe('AUTO:4,7');
  });

  it('sin tolerancia a erratas no incluye la clausula difusa', () => {
    const { exacta, prefijo, conErratas } = clausulas(
      buildSearchBody(query({ q: 'teclado', typoTolerant: false })),
    );

    expect(exacta).toBeDefined();
    expect(prefijo).toBeDefined();
    expect(conErratas).toBeUndefined();
  });

  it('con tolerancia a erratas anade la clausula difusa a las demas', () => {
    const { exacta, prefijo, conErratas } = clausulas(
      buildSearchBody(query({ q: 'teclado', typoTolerant: true })),
    );

    expect(exacta).toBeDefined();
    expect(prefijo).toBeDefined();
    expect(conErratas).toBeDefined();
  });

  it('no corrige erratas en consultas de menos de cuatro letras', () => {
    // AUTO:4,7 evita que "tro" (una edicion) arrastre todos los "Pro" del
    // catalogo: en consultas cortas la que manda es la clausula de prefijo.
    const { conErratas } = clausulas(buildSearchBody(query({ q: 'tro' })));

    expect(conErratas.fuzziness).toBe('AUTO:4,7');
  });

  it('busca tambien por prefijo a partir de tres letras', () => {
    const { prefijo } = clausulas(buildSearchBody(query({ q: 'tec' })));

    expect(prefijo).toBeDefined();
    expect(prefijo.query).toBe('tec');
    expect(prefijo.fields).toContain('name^4');
  });

  it('no busca por prefijo con menos de tres letras', () => {
    expect(clausulas(buildSearchBody(query({ q: 'te' }))).prefijo).toBeUndefined();
    expect(MIN_PREFIX_LENGTH).toBe(3);
  });

  it('el prefijo no toca la descripcion ni los tags', () => {
    const { prefijo } = clausulas(buildSearchBody(query({ q: 'tec' })));

    // phrase_prefix solo admite campos text, y un prefijo sobre la descripcion
    // devuelve demasiado ruido.
    expect(prefijo.fields).not.toContain('description');
    expect(prefijo.fields.some((field: string) => field.startsWith('tags'))).toBe(false);
  });

  it('prioriza la coincidencia exacta, luego el prefijo y por ultimo las erratas', () => {
    const { exacta, prefijo, conErratas } = clausulas(buildSearchBody(query({ q: 'zapa' })));

    expect(exacta.boost).toBeGreaterThan(prefijo.boost);
    expect(prefijo.boost).toBeGreaterThan(conErratas.boost);
    expect(exacta.fuzziness).toBeUndefined();
  });

  it('basta con que encaje una de las formas de buscar', () => {
    const bool = (buildSearchBody(query({ q: 'tec' })) as any).query.bool.must[0].bool;

    expect(bool.minimum_should_match).toBe(1);
    expect(bool.should).toHaveLength(3);
  });

  it('en la fase precisa solo compiten la exacta y el prefijo', () => {
    const bool = (buildSearchBody(query({ q: 'tec', typoTolerant: false })) as any).query.bool
      .must[0].bool;

    expect(bool.should).toHaveLength(2);
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

/** Separa las tres clausulas de texto para poder afirmar sobre cada una. */
function clausulas(body: any) {
  const should: any[] = body.query.bool.must[0].bool.should;
  const matches = should.map((clause) => clause.multi_match);

  return {
    exacta: matches.find((m: any) => m.type === 'best_fields' && !m.fuzziness),
    prefijo: matches.find((m: any) => m.type === 'phrase_prefix'),
    conErratas: matches.find((m: any) => typeof m.fuzziness === 'string'),
  };
}

describe('buildSuggestBody', () => {
  it('no devuelve documentos, solo nombres agregados', () => {
    const body = buildSuggestBody('auri', 5) as any;

    expect(body.size).toBe(0);
    expect(body.query.match_phrase_prefix.name.query).toBe('auri');
    expect(body.aggs.names.terms.size).toBe(5);
  });
});
