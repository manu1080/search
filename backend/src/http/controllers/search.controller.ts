import type { Request, RequestHandler, Response } from 'express';
import { z } from 'zod';
import { MAX_PAGE_SIZE } from '../../core/products/search-products.js';
import type { Container } from '../../container.js';
import { parseQuery } from '../middleware/validate.js';

/** Un mismo filtro puede llegar repetido (?brand=a&brand=b) o como valor único. */
const stringList = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => {
    if (value === undefined) return [];
    const raw = Array.isArray(value) ? value : [value];
    return raw.flatMap((item) => item.split(',')).map((item) => item.trim()).filter(Boolean);
  });

const searchQuerySchema = z.object({
  q: z.string().max(200).optional().default(''),
  brand: stringList,
  category: stringList,
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  inStock: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  sort: z.enum(['relevance', 'price_asc', 'price_desc', 'rating_desc']).optional().default('relevance'),
  page: z.coerce.number().int().min(1).optional().default(1),
  size: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional().default(24),
});

const suggestQuerySchema = z.object({
  q: z.string().max(200).optional().default(''),
  limit: z.coerce.number().int().min(1).max(20).optional().default(8),
});

export function searchController(container: Container): Record<string, RequestHandler> {
  return {
    // Endpoint público: es la parte abierta de la aplicación.
    search: async (req: Request, res: Response) => {
      const query = parseQuery(searchQuerySchema, req);
      const result = await container.useCases.searchProducts.execute({
        q: query.q,
        brands: query.brand,
        categories: query.category,
        minPrice: query.minPrice,
        maxPrice: query.maxPrice,
        minRating: query.minRating,
        inStockOnly: query.inStock,
        sort: query.sort,
        page: query.page,
        size: query.size,
      });
      res.json(result);
    },

    suggest: async (req: Request, res: Response) => {
      const { q, limit } = parseQuery(suggestQuerySchema, req);
      res.json({ suggestions: await container.useCases.suggestProducts.execute(q, limit) });
    },
  };
}
