import { describe, expect, it } from 'vitest';
import { LoginUser } from '../../src/core/auth/login-user.js';
import { RegisterUser } from '../../src/core/auth/register-user.js';
import { ConflictError, UnauthorizedError } from '../../src/core/shared/errors.js';
import { FakePasswordHasher, FakeTokenIssuer, InMemoryUserRepository } from '../fakes.js';

function build() {
  const users = new InMemoryUserRepository();
  const hasher = new FakePasswordHasher();
  const tokens = new FakeTokenIssuer();
  return {
    users,
    register: new RegisterUser(users, hasher, tokens),
    login: new LoginUser(users, hasher, tokens),
  };
}

describe('RegisterUser', () => {
  it('crea el usuario, normaliza el email y devuelve token', async () => {
    const { register } = build();

    const result = await register.execute({
      name: '  Manu  ',
      email: '  Manu@Example.COM ',
      password: 'secreto123',
    });

    expect(result.user.email).toBe('manu@example.com');
    expect(result.user.name).toBe('Manu');
    expect(result.token).toContain('manu@example.com');
  });

  it('nunca expone el hash de la contraseña', async () => {
    const { register } = build();
    const result = await register.execute({
      name: 'Manu',
      email: 'manu@example.com',
      password: 'secreto123',
    });

    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('rechaza un email ya registrado sin importar mayusculas', async () => {
    const { register } = build();
    await register.execute({ name: 'Manu', email: 'manu@example.com', password: 'secreto123' });

    await expect(
      register.execute({ name: 'Otro', email: 'MANU@example.com', password: 'secreto123' }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('LoginUser', () => {
  it('devuelve token con credenciales validas', async () => {
    const { register, login } = build();
    await register.execute({ name: 'Manu', email: 'manu@example.com', password: 'secreto123' });

    const result = await login.execute({ email: 'MANU@example.com', password: 'secreto123' });

    expect(result.user.email).toBe('manu@example.com');
  });

  it('falla con contraseña incorrecta', async () => {
    const { register, login } = build();
    await register.execute({ name: 'Manu', email: 'manu@example.com', password: 'secreto123' });

    await expect(login.execute({ email: 'manu@example.com', password: 'otra' })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it('devuelve el mismo error si el usuario no existe', async () => {
    const { login } = build();

    await expect(
      login.execute({ email: 'nadie@example.com', password: 'secreto123' }),
    ).rejects.toThrow('Email o contraseña incorrectos');
  });
});
