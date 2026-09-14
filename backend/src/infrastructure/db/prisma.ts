import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';
import { env } from '../../config/env.js';

let client: PrismaClient | undefined;

/** Cliente Prisma único por proceso (Prisma 7 exige driver adapter explicito). */
export function prisma(): PrismaClient {
  client ??= new PrismaClient({
    adapter: new PrismaPg({ connectionString: env().DATABASE_URL }),
  });
  return client;
}

export async function disconnectPrisma(): Promise<void> {
  await client?.$disconnect();
  client = undefined;
}
