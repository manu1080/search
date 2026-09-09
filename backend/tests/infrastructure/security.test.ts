import { describe, expect, it } from 'vitest';
import { UnauthorizedError } from '../../src/core/shared/errors.js';
import { BcryptPasswordHasher } from '../../src/infrastructure/security/bcrypt-password-hasher.js';
import { JwtTokenIssuer } from '../../src/infrastructure/security/jwt-token-issuer.js';

const SECRET = 'un-secreto-de-pruebas-suficientemente-largo';

describe('BcryptPasswordHasher', () => {
  // 4 rondas: suficiente para verificar el comportamiento sin ralentizar la suite.
  const hasher = new BcryptPasswordHasher(4);

  it('genera un hash distinto de la contraseña original', async () => {
    const hash = await hasher.hash('secreto123');

    expect(hash).not.toBe('secreto123');
    expect(hash.startsWith('$2')).toBe(true);
  });

  it('usa una sal distinta en cada hash', async () => {
    expect(await hasher.hash('secreto123')).not.toBe(await hasher.hash('secreto123'));
  });

  it('verifica la contraseña correcta', async () => {
    expect(await hasher.verify('secreto123', await hasher.hash('secreto123'))).toBe(true);
  });

  it('rechaza una contraseña incorrecta', async () => {
    expect(await hasher.verify('otra', await hasher.hash('secreto123'))).toBe(false);
  });

  it('devuelve false ante un hash corrupto en vez de lanzar', async () => {
    expect(await hasher.verify('secreto123', 'esto-no-es-un-hash')).toBe(false);
  });
});

describe('JwtTokenIssuer', () => {
  const tokens = new JwtTokenIssuer(SECRET, '1h');

  it('emite un token que el mismo emisor sabe leer', () => {
    const token = tokens.issue({ sub: 'user-1', email: 'manu@example.com' });

    expect(tokens.verify(token)).toEqual({ sub: 'user-1', email: 'manu@example.com' });
  });

  it('rechaza un token firmado con otro secreto', () => {
    const otro = new JwtTokenIssuer('otro-secreto-igual-de-largo-que-el-real', '1h');
    const token = otro.issue({ sub: 'user-1', email: 'manu@example.com' });

    expect(() => tokens.verify(token)).toThrow(UnauthorizedError);
  });

  it('rechaza un token manipulado', () => {
    const token = tokens.issue({ sub: 'user-1', email: 'manu@example.com' });

    expect(() => tokens.verify(`${token}x`)).toThrow(UnauthorizedError);
  });

  it('rechaza un token ya caducado', () => {
    const caducado = new JwtTokenIssuer(SECRET, '-1s');
    const token = caducado.issue({ sub: 'user-1', email: 'manu@example.com' });

    expect(() => tokens.verify(token)).toThrow('Token inválido o expirado');
  });

  it('rechaza basura que no es un token', () => {
    expect(() => tokens.verify('no-es-un-token')).toThrow(UnauthorizedError);
  });
});
