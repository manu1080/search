import type { UserWithCredentials } from './user.js';

export interface CreateUserInput {
  email: string;
  name: string;
  passwordHash: string;
}

export interface UpdateUserInput {
  email?: string;
  name?: string;
  bio?: string | null;
  avatarUrl?: string | null;
  passwordHash?: string;
}

export interface UserRepository {
  findById(id: string): Promise<UserWithCredentials | null>;
  findByEmail(email: string): Promise<UserWithCredentials | null>;
  create(input: CreateUserInput): Promise<UserWithCredentials>;
  update(id: string, input: UpdateUserInput): Promise<UserWithCredentials>;
}
