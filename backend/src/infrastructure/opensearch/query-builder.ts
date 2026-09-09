import type { SearchProductsQuery } from '../../core/products/product-search-repository.port.js';

type Json = Record<string, unknown>;

/**
 * Traduce la consulta de dominio al DSL de OpenSearch. Es una funcion pura para
 * poder testear el DSL generado sin levantar el motor.
 */
export function buildSearchBody(query: SearchProductsQuery): Json {
  const filters: Json[] = [];

  if (query.brands.length > 0) filters.push({ terms: { 'brand.keyword': query.brands } });
  if (query.categories.length > 0)
    filters.push({ terms: { 'category.keyword': query.categories } });
  if (query.inStockOnly) filters.push({ range: { stock: { gt: 0 } } });
  if (query.minRating !== undefined) filters.push({ range: { rating: { gte: query.minRating } } });

  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filters.push({
      range: {
        price: {
          ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
          ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
        },
      },
    });
  }

  const must: Json = query.q
    ? {
        multi_match: {
          query: query.q,
          fields: ['name^4', 'brand^2', 'tags^2', 'category', 'description'],
          type: 'best_fields',
          fuzziness: 'AUTO',
          operator: 'and',
        },
      }
    : { match_all: {} };

  return {
    from: (query.page - 1) * query.size,
    size: query.size,
    track_total_hits: true,
    query: {
      bool: {
        must: [must],
        filter: filters,
      },
    },
    sort: buildSort(query),
    highlight: {
      pre_tags: ['<mark>'],
      post_tags: ['</mark>'],
      fields: {
        name: { number_of_fragments: 0 },
        description: { fragment_size: 140, number_of_fragments: 1 },
      },
    },
    aggs: {
      brands: { terms: { field: 'brand.keyword', size: 15 } },
      categories: { terms: { field: 'category.keyword', size: 15 } },
      price_stats: { stats: { field: 'price' } },
    },
  };
}

function buildSort(query: SearchProductsQuery): Json[] {
  switch (query.sort) {
    case 'price_asc':
      return [{ price: 'asc' }, { _score: 'desc' }];
    case 'price_desc':
      return [{ price: 'desc' }, { _score: 'desc' }];
    case 'rating_desc':
      return [{ rating: 'desc' }, { _score: 'desc' }];
    case 'relevance':
    default:
      // Sin texto de búsqueda todos los documentos empatan a score, así que se
      // ordena por valoración para que la primera pantalla no sea aleatoria.
      return query.q ? [{ _score: 'desc' }, { rating: 'desc' }] : [{ rating: 'desc' }];
  }
}

export function buildSuggestBody(prefix: string, limit: number): Json {
  return {
    size: 0,
    query: {
      match_phrase_prefix: { name: { query: prefix, max_expansions: 30 } },
    },
    aggs: {
      names: { terms: { field: 'name.keyword', size: limit } },
    },
  };
}
