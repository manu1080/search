import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { env } from '../src/config/env.js';

const config = env();
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: config.DATABASE_URL }),
});

const DEMO_EMAIL = 'demo@search.local';
const DEMO_PASSWORD = 'Demo1234!';

const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

const user = await prisma.user.upsert({
  where: { email: DEMO_EMAIL },
  update: { passwordHash },
  create: {
    email: DEMO_EMAIL,
    name: 'Usuario Demo',
    passwordHash,
    bio: 'Cuenta de demostración del buscador.',
  },
});

console.log(`Usuario listo: ${user.email} / ${DEMO_PASSWORD}`);
await prisma.$disconnect();
