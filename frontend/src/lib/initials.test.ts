import { describe, expect, it } from 'vitest';
import { initials } from './initials';

describe('initials', () => {
  it('toma la inicial de los dos primeros nombres', () => {
    expect(initials('Usuario Demo')).toBe('UD');
  });

  it('funciona con un solo nombre', () => {
    expect(initials('Manu')).toBe('M');
  });

  it('ignora los espacios de mas', () => {
    expect(initials('  Ana   Maria  Lopez ')).toBe('AM');
  });

  it('devuelve un marcador si el nombre esta vacio', () => {
    expect(initials('   ')).toBe('?');
  });
});
