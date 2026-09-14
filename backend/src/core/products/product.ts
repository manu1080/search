import { z } from 'zod';

/** Producto tal y como vive en el indice de búsqueda. */
export interface Product {
  sku: string;
  name: string;
  description: string;
  brand: string;
  category: string;
  price: number;
  currency: string;
  stock: number;
  rating: number;
  imageUrl: string | null;
  tags: string[];
  indexedAt: string;
}

/** Producto devuelto por una búsqueda: incluye score y fragmentos resaltados. */
export interface ProductHit extends Product {
  score: number;
  highlight?: {
    name?: string;
    description?: string;
  };
}

const emptyToNull = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? null : value;

/**
 * Una celda vacia en un CSV significa "sin valor", no "cadena vacia": se
 * convierte en undefined para que actue el valor por defecto del esquema.
 */
const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const optional = <T extends z.ZodType>(schema: T) => z.preprocess(emptyToUndefined, schema);

/**
 * Contrato de una fila de CSV. Es deliberadamente tolerante con el formato de
 * entrada (números con coma, tags separados por | o ,) pero estricto con el
 * resultado: lo que sale de aquí ya es un Product valido.
 */
export const productRowSchema = z.object({
  sku: z.string().trim().min(1, 'sku es obligatorio').max(64),
  name: z.string().trim().min(1, 'name es obligatorio').max(300),
  description: optional(z.string().trim().max(5000).default('')),
  brand: optional(z.string().trim().max(120).default('Sin marca')),
  category: optional(z.string().trim().max(120).default('Sin categoría')),
  price: z.coerce.number().nonnegative('price no puede ser negativo'),
  currency: optional(z.string().trim().length(3).toUpperCase().default('EUR')),
  stock: optional(z.coerce.number().int().nonnegative().default(0)),
  rating: optional(z.coerce.number().min(0).max(5).default(0)),
  imageUrl: z.preprocess(emptyToNull, z.string().url().nullable().default(null)),
  tags: optional(z.string().default(''))
    .transform((value) =>
      String(value)
        .split(/[|,;]/)
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0),
    ),
});

export type ProductRow = z.infer<typeof productRowSchema>;

/** Normaliza los valores numericos escritos con coma decimal antes de validar. */
export function normalizeRawRow(raw: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    const cleanKey = key.trim();
    normalized[cleanKey] =
      typeof value === 'string' && ['price', 'rating'].includes(cleanKey)
        ? value.trim().replace(',', '.')
        : value;
  }
  return normalized;
}
