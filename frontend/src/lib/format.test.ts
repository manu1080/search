import { describe, expect, it } from 'vitest';
import { formatBytes, formatPrice } from './format';

describe('formatPrice', () => {
  it('formatea en euros con coma decimal y simbolo al final', () => {
    // El separador de millares depende de los datos ICU disponibles, por eso se
    // comprueba el patron y no una cadena literal.
    expect(formatPrice(1234.5, 'EUR')).toMatch(/^1\.?234,50\s?€$/);
  });

  it('respeta otras divisas', () => {
    expect(formatPrice(10, 'USD')).toContain('10,00');
  });

  it('cae a EUR si la divisa llega vacia', () => {
    expect(formatPrice(10, '')).toContain('€');
  });
});

describe('formatBytes', () => {
  it.each([
    [512, '512 B'],
    [2048, '2.0 KB'],
    [5 * 1024 * 1024, '5.0 MB'],
  ])('formatea %i como %s', (input, expected) => {
    expect(formatBytes(input)).toBe(expected);
  });
});
