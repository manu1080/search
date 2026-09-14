import { ConflictError } from '../shared/errors.js';
import { toPublicUser, type User } from '../users/user.js';
import type { UserRepository } from '../users/user-repository.port.js';
import type { PasswordHasher } from './password-hasher.port.js';
import type { TokenIssuer } from './token-issuer.port.js';

export interface RegisterUserInput {
  email: string;
  name: string;
  password: string;
}

export interface AuthResult {
  token: string;
  user: User;
}

/** Alta de usuario: normaliza el email, exige unicidad y devuelve sesión iniciada. */
export class RegisterUser {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenIssuer,
  ) {}

  async execute(input: RegisterUserInput): Promise<AuthResult> {
    const email = input.email.trim().toLowerCase();

    if (await this.users.findByEmail(email)) {
      throw new ConflictError('Ya existe una cuenta con ese email');
    }

    const created = await this.users.create({
      email,
      name: input.name.trim(),
      passwordHash: await this.hasher.hash(input.password),
    });

    const user = toPublicUser(created);
    return { token: this.tokens.issue({ sub: user.id, email: user.email }), user };
  }
}
