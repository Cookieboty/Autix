import { getDatabaseUrl, PrismaClient } from '@autix/database';
import { PrismaPg } from '@prisma/adapter-pg';

type SeedPrismaClient = ReturnType<typeof createPrismaClient>;

export function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: getDatabaseUrl(),
  });
  return new PrismaClient({ adapter });
}

export async function ensureSeedAuthor(prisma: SeedPrismaClient, authorId: string) {
  await prisma.user.upsert({
    where: { id: authorId },
    update: {},
    create: {
      id: authorId,
      username: authorId,
      email: `${authorId}@seed.local`,
      realName: 'Seed Author',
      status: 'ACTIVE',
    },
  });
}
