import { UnauthorizedError } from '../shared/errors.js';
import { toPublicUser } from '../users/user.js';
import type { UserRepository } from '../users/user-repository.port.js';
import type { AuthResult } from './register-user.js';
import type { PasswordHasher } from './password-hasher.port.js';
import type { TokenIssuer } from './token-issuer.port.js';

export interface LoginUserInput {
  email: string;
  password: string;
}

export class LoginUser {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenIssuer,
  ) {}

  async execute(input: LoginUserInput): Promise<AuthResult> {
    const email = input.email.trim().toLowerCase();
    const found = await this.users.findByEmail(email);

    // Se verifica siempre contra un hash (real o dummy) para no filtrar por
    // tiempo de respuesta si el email existe o no.
    const hash = found?.passwordHash ?? '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin';
    const valid = await this.hasher.verify(input.password, hash);

    if (!found || !valid) {
      throw new UnauthorizedError('Email o contraseña incorrectos');
    }

    const user = toPublicUser(found);
    return { token: this.tokens.issue({ sub: user.id, email: user.email }), user };
  }
}
