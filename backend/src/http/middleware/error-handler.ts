import type { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import type { Logger } from 'pino';
import { ZodError } from 'zod';
import { AppError } from '../../core/shared/errors.js';

export function errorHandler(logger: Logger) {
  return (error: unknown, _req: Request, res: Response, next: NextFunction): void => {
    if (res.headersSent) return next(error);

    if (error instanceof AppError) {
      res.status(error.status).json({
        error: { code: error.code, message: error.message, details: error.details },
      });
      return;
    }

    if (error instanceof ZodError) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Datos de entrada inválidos',
          details: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      });
      return;
    }

    if (error instanceof MulterError) {
      const message =
        error.code === 'LIMIT_FILE_SIZE' ? 'El fichero supera el tamaño máximo' : error.message;
      res.status(413).json({ error: { code: error.code, message } });
      return;
    }

    logger.error({ err: error }, 'Error no controlado');
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Ha ocurrido un error inesperado' },
    });
  };
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ruta no encontrada' } });
}
