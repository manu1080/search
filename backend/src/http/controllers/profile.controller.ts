import type { Request, RequestHandler, Response } from 'express';
import { z } from 'zod';
import type { Container } from '../../container.js';
import { currentUser } from '../middleware/require-auth.js';
import { parseBody } from '../middleware/validate.js';

const emptyToNull = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? null : value;

const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  email: z.string().trim().toLowerCase().email('Email inválido').optional(),
  bio: z.preprocess(emptyToNull, z.string().max(500).nullable()).optional(),
  avatarUrl: z
    .preprocess(emptyToNull, z.string().url('La URL del avatar no es valida').nullable())
    .optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres').max(128),
});

export function profileController(container: Container): Record<string, RequestHandler> {
  return {
    get: async (req: Request, res: Response) => {
      const user = await container.useCases.getProfile.execute(currentUser(req).userId);
      res.json({ user });
    },

    update: async (req: Request, res: Response) => {
      const user = await container.useCases.updateProfile.execute(
        currentUser(req).userId,
        parseBody(updateProfileSchema, req),
      );
      res.json({ user });
    },

    changePassword: async (req: Request, res: Response) => {
      const { currentPassword, newPassword } = parseBody(changePasswordSchema, req);
      await container.useCases.changePassword.execute(
        currentUser(req).userId,
        currentPassword,
        newPassword,
      );
      res.status(204).send();
    },
  };
}
