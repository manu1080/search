import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Product } from '../../lib/types';
import { ProductCard } from './ProductCard';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    sku: 'SKU-1',
    name: 'Auriculares Sony',
    description: 'Con cancelacion de ruido',
    brand: 'Sony',
    category: 'Audio',
    price: 199.99,
    currency: 'EUR',
    stock: 12,
    rating: 4.5,
    imageUrl: 'https://example.test/a.jpg',
    tags: ['audio'],
    indexedAt: '2026-01-01T00:00:00.000Z',
    score: 1,
    ...overrides,
  };
}

describe('ProductCard', () => {
  it('muestra nombre, marca, precio y valoración', () => {
    render(<ProductCard product={makeProduct()} />);

    expect(screen.getByText('Auriculares Sony')).toBeInTheDocument();
    expect(screen.getByText('Sony')).toBeInTheDocument();
    expect(screen.getByText('4.5')).toBeInTheDocument();
    expect(screen.getByText(/199,99/)).toBeInTheDocument();
  });

  it('avisa cuando no hay stock', () => {
    render(<ProductCard product={makeProduct({ stock: 0 })} />);

    expect(screen.getByText('Sin stock')).toBeInTheDocument();
    expect(screen.getByText('Agotado')).toBeInTheDocument();
  });

  it('pinta el resaltado que devuelve el buscador', () => {
    render(
      <ProductCard
        product={makeProduct({ highlight: { name: '<mark>Auriculares</mark> Sony' } })}
      />,
    );

    expect(screen.getByText('Auriculares').tagName).toBe('MARK');
  });

  it('usa un marcador de posicion si el producto no tiene imagen', () => {
    render(<ProductCard product={makeProduct({ imageUrl: null })} />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
