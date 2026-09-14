import { describe, expect, it } from 'vitest';
import { ChangePassword, GetProfile, UpdateProfile } from '../../src/core/users/update-profile.js';
import { ConflictError, NotFoundError, UnauthorizedError } from '../../src/core/shared/errors.js';
import { FakePasswordHasher, InMemoryUserRepository } from '../fakes.js';

async function seedUser(users: InMemoryUserRepository, email = 'manu@example.com') {
  return users.create({ email, name: 'Manu', passwordHash: 'hashed:secreto123' });
}

describe('UpdateProfile', () => {
  it('actualiza solo los campos enviados', async () => {
    const users = new InMemoryUserRepository();
    const user = await seedUser(users);

    const updated = await new UpdateProfile(users).execute(user.id, { bio: 'Hola' });

    expect(updated.bio).toBe('Hola');
    expect(updated.name).toBe('Manu');
    expect(updated.email).toBe('manu@example.com');
  });

  it('permite vaciar la bio con null', async () => {
    const users = new InMemoryUserRepository();
    const user = await seedUser(users);
    await new UpdateProfile(users).execute(user.id, { bio: 'Hola' });

    const updated = await new UpdateProfile(users).execute(user.id, { bio: null });

    expect(updated.bio).toBeNull();
  });

  it('rechaza un email que ya usa otro usuario', async () => {
    const users = new InMemoryUserRepository();
    const user = await seedUser(users);
    await seedUser(users, 'otro@example.com');

    await expect(
      new UpdateProfile(users).execute(user.id, { email: 'otro@example.com' }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('acepta guardar el propio email sin cambios', async () => {
    const users = new InMemoryUserRepository();
    const user = await seedUser(users);

    const updated = await new UpdateProfile(users).execute(user.id, { email: 'MANU@example.com' });

    expect(updated.email).toBe('manu@example.com');
  });
});

describe('GetProfile', () => {
  it('falla si el usuario no existe', async () => {
    await expect(new GetProfile(new InMemoryUserRepository()).execute('nope')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe('ChangePassword', () => {
  it('exige la contraseña actual correcta', async () => {
    const users = new InMemoryUserRepository();
    const user = await seedUser(users);
    const useCase = new ChangePassword(users, new FakePasswordHasher());

    await expect(useCase.execute(user.id, 'incorrecta', 'nueva12345')).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it('guarda el hash de la nueva contraseña', async () => {
    const users = new InMemoryUserRepository();
    const user = await seedUser(users);

    await new ChangePassword(users, new FakePasswordHasher()).execute(
      user.id,
      'secreto123',
      'nueva12345',
    );

    expect((await users.findById(user.id))?.passwordHash).toBe('hashed:nueva12345');
  });
});
