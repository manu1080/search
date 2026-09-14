import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET debe tener al menos 16 caracteres'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  RABBITMQ_URL: z.string().min(1),
  OPENSEARCH_URL: z.string().url(),
  OPENSEARCH_PRODUCTS_INDEX: z.string().default('products'),
  UPLOAD_DIR: z.string().default('storage/uploads'),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(20 * 1024 * 1024),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Lee y valida el entorno una sola vez. Falla rápido y con un mensaje claro
 * si falta cualquier variable, en vez de explotar a mitad de una petición.
 */
function loadEnv(): Env {
  // Carga el .env del backend si existe; en produccion/CI mandan las variables reales.
  try {
    const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
    process.loadEnvFile(path.join(backendRoot, '.env'));
  } catch {
    // Sin fichero .env: se usa el entorno tal cual.
  }

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Configuración de entorno inválida:\n${detail}`);
  }
  return parsed.data;
}

let cached: Env | undefined;

export function env(): Env {
  cached ??= loadEnv();
  return cached;
}
