import type {
  ProductSearchRepository,
  SearchProductsInput,
  SearchProductsResult,
} from './product-search-repository.port.js';

export const MAX_PAGE_SIZE = 60;

/**
 * Caso de uso de búsqueda. Acota página y tamaño antes de tocar el repositorio,
 * de forma que ningún cliente pueda pedir páginas absurdas al motor.
 *
 * Busca en dos fases: primero sin tolerancia a erratas y, solo si no hay ni un
 * resultado, reintenta admitiéndolas. Corregir erratas siempre añadía ruido a
 * las búsquedas que ya funcionaban ("camara" devolvía 15 productos de los que
 * 9 no tenían nada que ver) y falseaba los recuentos de las facetas.
 */
export class SearchProducts {
  constructor(private readonly repository: ProductSearchRepository) {}

  async execute(input: SearchProductsInput): Promise<SearchProductsResult> {
    const query = {
      ...input,
      q: input.q.trim(),
      page: Math.max(1, input.page),
      size: Math.min(Math.max(1, input.size), MAX_PAGE_SIZE),
    };

    const preciso = await this.repository.search({ ...query, typoTolerant: false });

    // Sin texto que corregir, el reintento daría exactamente lo mismo.
    if (preciso.total > 0 || query.q === '') return preciso;

    return this.repository.search({ ...query, typoTolerant: true });
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
