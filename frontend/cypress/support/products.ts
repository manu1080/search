/**
 * Catalogo de pruebas con marca y nombre propios ("Zephyra", "Trombolino") para
 * que los recuentos de cada test no dependan del catalogo de demostracion que
 * pueda haber indexado.
 */
export interface E2eProduct {
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
}

export const E2E_BRAND = 'Zephyra';
export const E2E_TERM = 'Trombolino';
export const E2E_SKU_PREFIX = 'E2E-';

export const e2eProducts: E2eProduct[] = [
  product('E2E-0001', 'Trombolino Uno', 'Laboratorio', 10, 5, 4.1),
  product('E2E-0002', 'Trombolino Dos', 'Laboratorio', 20, 0, 4.9),
  product('E2E-0003', 'Trombolino Tres', 'Laboratorio', 30, 7, 3.2),
  product('E2E-0004', 'Trombolino Cuatro', 'Laboratorio', 40, 0, 4.4),
  product('E2E-0005', 'Trombolino Cinco', 'Taller', 50, 2, 5),
  product('E2E-0006', 'Trombolino Seis', 'Taller', 60, 0, 3.8),
];

export const E2E_COUNTS = {
  total: e2eProducts.length,
  laboratorio: e2eProducts.filter((p) => p.category === 'Laboratorio').length,
  taller: e2eProducts.filter((p) => p.category === 'Taller').length,
  conStock: e2eProducts.filter((p) => p.stock > 0).length,
};

function product(
  sku: string,
  name: string,
  category: string,
  price: number,
  stock: number,
  rating: number,
): E2eProduct {
  return {
    sku,
    name,
    description: `Artículo de prueba ${name} de la línea ${E2E_BRAND}.`,
    brand: E2E_BRAND,
    category,
    price,
    currency: 'EUR',
    stock,
    rating,
    imageUrl: null,
    tags: ['e2e', 'prueba'],
  };
}

/** Las mismas filas en CSV, para la prueba de la importacion completa. */
export function e2eCsv(products: E2eProduct[] = e2eProducts): string {
  const header = 'sku,name,description,brand,category,price,currency,stock,rating,imageUrl,tags';
  const rows = products.map((p) =>
    [
      p.sku,
      p.name,
      p.description,
      p.brand,
      p.category,
      p.price,
      p.currency,
      p.stock,
      p.rating,
      p.imageUrl ?? '',
      p.tags.join('|'),
    ].join(','),
  );
  return [header, ...rows].join('\n') + '\n';
}
