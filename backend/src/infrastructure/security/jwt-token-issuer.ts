import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../../core/shared/errors.js';
import type { TokenIssuer, TokenPayload } from '../../core/auth/token-issuer.port.js';

export class JwtTokenIssuer implements TokenIssuer {
  constructor(
    private readonly secret: string,
    private readonly expiresIn: string,
  ) {}

  issue(payload: TokenPayload): string {
    return jwt.sign(payload, this.secret, {
      expiresIn: this.expiresIn as jwt.SignOptions['expiresIn'],
    });
  }

  verify(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, this.secret);
      if (typeof decoded === 'string' || !decoded.sub || typeof decoded.email !== 'string') {
        throw new UnauthorizedError('Token inválido');
      }
      return { sub: String(decoded.sub), email: decoded.email };
    } catch (error) {
      if (error instanceof UnauthorizedError) throw error;
      throw new UnauthorizedError('Token inválido o expirado');
    }
  }
}
