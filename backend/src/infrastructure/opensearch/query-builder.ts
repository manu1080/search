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

  return {
    from: (query.page - 1) * query.size,
    size: query.size,
    track_total_hits: true,
    query: {
      bool: {
        must: [buildTextQuery(query.q, query.typoTolerant)],
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

/** A partir de esta longitud se busca tambien por prefijo (ver buildTextQuery). */
export const MIN_PREFIX_LENGTH = 3;

/**
 * Consulta de texto. Combina varias formas de encontrar un producto, porque
 * resuelven problemas distintos:
 *
 * - `best_fields` tal cual: lo que el usuario escribio.
 * - `phrase_prefix`: trata el ultimo termino como el principio de una palabra,
 *   que es lo que hace falta mientras todavia esta escribiendo. Solo a partir
 *   de MIN_PREFIX_LENGTH caracteres: con una o dos letras devolveria
 *   practicamente el catalogo entero.
 * - `best_fields` con `fuzziness`: tolera erratas sobre palabras completas
 *   ("teclao" encuentra "teclado"), pero no sirve para palabras a medias:
 *   "tec" esta a 4 ediciones de "teclado" y AUTO permite como mucho 2.
 *
 * La clausula de erratas solo se incluye cuando `typoTolerant` lo pide, es
 * decir, en el reintento que hace el caso de uso cuando no hubo resultados.
 */
function buildTextQuery(q: string, typoTolerant: boolean): Json {
  if (!q) return { match_all: {} };

  const TEXT_FIELDS = ['name^4', 'brand^2', 'tags^2', 'category', 'description'];

  // Los boosts van escalonados a proposito: lo que el usuario escribio tal cual
  // pesa mas que un prefijo, y un prefijo mas que una correccion de erratas. Sin
  // esto, escribir "zapa" saca antes "Zara" (a una edicion) que "Zapatillas".
  const exacta: Json = {
    multi_match: {
      query: q,
      fields: TEXT_FIELDS,
      type: 'best_fields',
      operator: 'and',
      boost: 5,
    },
  };

  const conErratas: Json = {
    multi_match: {
      query: q,
      fields: TEXT_FIELDS,
      type: 'best_fields',
      // AUTO:4,7 = sin erratas por debajo de 4 letras, una hasta 6 y dos a
      // partir de 7. Con el AUTO por defecto, "tro" admite una edicion y
      // arrastra todos los "Pro" del catalogo: en consultas cortas manda el
      // prefijo, no la correccion.
      fuzziness: 'AUTO:4,7',
      operator: 'and',
      boost: 1,
    },
  };

  const should: Json[] = [exacta];

  if (q.length >= MIN_PREFIX_LENGTH) {
    should.push({
      multi_match: {
        query: q,
        // Sin `description` (un prefijo suelto ahi genera mucho ruido) y sin
        // `tags`, que es keyword: phrase_prefix solo admite campos text.
        fields: ['name^4', 'brand^2', 'category'],
        type: 'phrase_prefix',
        boost: 3,
      },
    });
  }

  if (typoTolerant) should.push(conErratas);

  return { bool: { should, minimum_should_match: 1 } };
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
