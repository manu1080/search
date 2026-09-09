import 'express';

declare module 'express-serve-static-core' {
  interface Request {
    /** Usuario autenticado, presente solo tras pasar por requireAuth. */
    auth?: { userId: string; email: string };
  }
}
