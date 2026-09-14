import type { Request } from 'express';
import type { ZodType } from 'zod';

/** Valida y tipa el body/query de la petición; el ZodError lo traduce el error handler. */
export function parseBody<T>(schema: ZodType<T>, req: Request): T {
  return schema.parse(req.body);
}

export function parseQuery<T>(schema: ZodType<T>, req: Request): T {
  return schema.parse(req.query);
}
