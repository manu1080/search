import type { Request, RequestHandler, Response } from 'express';
import { z } from 'zod';
import { ValidationError } from '../../core/shared/errors.js';
import type { Container } from '../../container.js';
import { currentUser } from '../middleware/require-auth.js';
import { parseQuery } from '../middleware/validate.js';

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
});

export function uploadsController(container: Container): Record<string, RequestHandler> {
  return {
    create: async (req: Request, res: Response) => {
      if (!req.file) throw new ValidationError('Falta el fichero en el campo "file"');

      const job = await container.useCases.createUploadJob.execute({
        userId: currentUser(req).userId,
        originalName: req.file.originalname,
        content: req.file.buffer,
      });

      // 202: el fichero esta aceptado, pero lo procesa el worker en segundo plano.
      res.status(202).json({ job });
    },

    list: async (req: Request, res: Response) => {
      const { limit } = parseQuery(listQuerySchema, req);
      const jobs = await container.useCases.listUploadJobs.execute(currentUser(req).userId, limit);
      res.json({ jobs });
    },

    get: async (req: Request, res: Response) => {
      const job = await container.useCases.getUploadJob.execute(
        String(req.params.id),
        currentUser(req).userId,
      );
      res.json({ job });
    },
  };
}
