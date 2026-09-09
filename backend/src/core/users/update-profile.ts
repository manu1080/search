import type { PasswordHasher } from '../auth/password-hasher.port.js';
import { ConflictError, NotFoundError, UnauthorizedError } from '../shared/errors.js';
import { toPublicUser, type User } from './user.js';
import type { UserRepository } from './user-repository.port.js';

export interface UpdateProfileInput {
  name?: string;
  email?: string;
  bio?: string | null;
  avatarUrl?: string | null;
}

export class GetProfile {
  constructor(private readonly users: UserRepository) {}

  async execute(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError('Usuario');
    return toPublicUser(user);
  }
}

export class UpdateProfile {
  constructor(private readonly users: UserRepository) {}

  async execute(userId: string, input: UpdateProfileInput): Promise<User> {
    const current = await this.users.findById(userId);
    if (!current) throw new NotFoundError('Usuario');

    const email = input.email?.trim().toLowerCase();
    if (email && email !== current.email) {
      const taken = await this.users.findByEmail(email);
      if (taken) throw new ConflictError('Ese email ya esta en uso');
    }

    const updated = await this.users.update(userId, {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(email !== undefined ? { email } : {}),
      ...(input.bio !== undefined ? { bio: input.bio } : {}),
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
    });

    return toPublicUser(updated);
  }
}

export class ChangePassword {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  async execute(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError('Usuario');

    if (!(await this.hasher.verify(currentPassword, user.passwordHash))) {
      throw new UnauthorizedError('La contraseña actual no es correcta');
    }

    await this.users.update(userId, { passwordHash: await this.hasher.hash(newPassword) });
  }
}
