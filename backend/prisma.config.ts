import { defineConfig } from 'prisma/config';

// Prisma 7 ya no carga el .env por su cuenta.
try {
  process.loadEnvFile(new URL('.env', import.meta.url).pathname);
} catch {
  // En CI/produccion las variables vienen del entorno real.
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
