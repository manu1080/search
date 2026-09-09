import type { Request, RequestHandler, Response } from 'express';
import { z } from 'zod';
import type { Container } from '../../container.js';
import { currentUser } from '../middleware/require-auth.js';
import { parseBody } from '../middleware/validate.js';

const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(128);

const registerSchema = z.object({
  name: z.string().trim().min(2, 'El nombre es demasiado corto').max(80),
  email: z.string().trim().toLowerCase().email('Email inválido'),
  password: passwordSchema,
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

/** Controladores finos: validan, delegan en el caso de uso y serializan. */
export function authController(container: Container): Record<string, RequestHandler> {
  return {
    register: async (req: Request, res: Response) => {
      const result = await container.useCases.registerUser.execute(parseBody(registerSchema, req));
      res.status(201).json(result);
    },

    login: async (req: Request, res: Response) => {
      const result = await container.useCases.loginUser.execute(parseBody(loginSchema, req));
      res.json(result);
    },

    me: async (req: Request, res: Response) => {
      const user = await container.useCases.getProfile.execute(currentUser(req).userId);
      res.json({ user });
    },
  };
}
