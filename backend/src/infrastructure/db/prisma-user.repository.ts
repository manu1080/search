import type { PrismaClient } from '../../generated/prisma/client.js';
import type { UserWithCredentials } from '../../core/users/user.js';
import type {
  CreateUserInput,
  UpdateUserInput,
  UserRepository,
} from '../../core/users/user-repository.port.js';

type PrismaUser = Awaited<ReturnType<PrismaClient['user']['create']>>;

function toDomain(row: PrismaUser): UserWithCredentials {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.passwordHash,
    bio: row.bio,
    avatarUrl: row.avatarUrl,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly db: PrismaClient) {}

  async findById(id: string): Promise<UserWithCredentials | null> {
    const row = await this.db.user.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findByEmail(email: string): Promise<UserWithCredentials | null> {
    const row = await this.db.user.findUnique({ where: { email } });
    return row ? toDomain(row) : null;
  }

  async create(input: CreateUserInput): Promise<UserWithCredentials> {
    return toDomain(await this.db.user.create({ data: input }));
  }

  async update(id: string, input: UpdateUserInput): Promise<UserWithCredentials> {
    return toDomain(await this.db.user.update({ where: { id }, data: input }));
  }
}
