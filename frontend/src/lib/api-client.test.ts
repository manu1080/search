import { describe, expect, it } from 'vitest';
import { buildSearchParams } from './api-client';
import { emptyFilters } from '../features/search/use-search';

describe('buildSearchParams', () => {
  it('omite todo lo que esta vacio o es el valor por defecto', () => {
    expect(buildSearchParams(emptyFilters).toString()).toBe('size=24');
  });

  it('repite el parametro por cada faceta seleccionada', () => {
    const params = buildSearchParams({
      ...emptyFilters,
      q: 'auriculares',
      brands: ['Sony', 'JBL'],
      categories: ['Audio'],
    });

    expect(params.getAll('brand')).toEqual(['Sony', 'JBL']);
    expect(params.getAll('category')).toEqual(['Audio']);
    expect(params.get('q')).toBe('auriculares');
  });

  it('incluye precio, stock, orden y página cuando difieren del valor por defecto', () => {
    const params = buildSearchParams({
      ...emptyFilters,
      minPrice: 10,
      maxPrice: 200,
      inStockOnly: true,
      sort: 'price_asc',
      page: 3,
    });

    expect(params.get('minPrice')).toBe('10');
    expect(params.get('maxPrice')).toBe('200');
    expect(params.get('inStock')).toBe('true');
    expect(params.get('sort')).toBe('price_asc');
    expect(params.get('page')).toBe('3');
  });

  it('no manda maxPrice si no se ha tocado el filtro', () => {
    expect(buildSearchParams({ ...emptyFilters, minPrice: 5 }).has('maxPrice')).toBe(false);
  });
});
