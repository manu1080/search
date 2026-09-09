import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { TokenIssuer } from '../../core/auth/token-issuer.port.js';
import { UnauthorizedError } from '../../core/shared/errors.js';

export function requireAuth(tokens: TokenIssuer): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const header = req.header('authorization');
    if (!header?.toLowerCase().startsWith('bearer ')) {
      return next(new UnauthorizedError('Falta el token de autenticación'));
    }

    try {
      const payload = tokens.verify(header.slice(7).trim());
      req.auth = { userId: payload.sub, email: payload.email };
      next();
    } catch (error) {
      next(error);
    }
  };
}

/** Acceso al usuario autenticado sin repetir comprobaciones en cada controlador. */
export function currentUser(req: Request): { userId: string; email: string } {
  if (!req.auth) throw new UnauthorizedError();
  return req.auth;
}
