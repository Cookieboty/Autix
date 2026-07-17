/**
 * 测试进程侧的数据库句柄：独立 Prisma 客户端（不经 Nest DI），
 * 负责造一次性用户 + 签 JWT + 轮询断言 + 作用域清理。
 * 所有写入以一次性用户为界，清理只删该用户的行。
 */
import { getDatabaseUrl, PrismaClient } from '@autix/database';
import { PrismaPg } from '@prisma/adapter-pg';
import jwt from 'jsonwebtoken';

export function makePrisma() {
  const adapter = new PrismaPg({ connectionString: getDatabaseUrl() });
  return new PrismaClient({ adapter } as any);
}

export type TestUser = {
  userId: string;
  username: string;
  token: string;
};

export async function createTestUser(prisma: any): Promise<TestUser> {
  const runId = `e2e${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const user = await withRetry(() =>
    prisma.user.create({
      data: { username: runId, email: `${runId}@e2e.local`, status: 'ACTIVE' },
    }),
  );
  const session = await withRetry(() =>
    prisma.userSession.create({
      data: {
        userId: user.id,
        refreshToken: `${runId}_rt`,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
        ip: '127.0.0.1',
        userAgent: 'e2e',
      },
    }),
  );
  const token = jwt.sign(
    { sub: user.id, username: user.username, sessionId: session.id, language: user.language },
    process.env.JWT_SECRET as string,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '1d' },
  );
  return { userId: user.id, username: user.username, token };
}

/** 对偶发的数据库连接抖动做重试。 */
export async function withRetry<T>(fn: () => Promise<T>, tries = 5, delayMs = 1_000): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw last;
}

export async function pollUntil<T>(
  fn: () => Promise<T | null | undefined>,
  opts: { timeoutMs: number; intervalMs: number; label?: string },
): Promise<T> {
  const deadline = Date.now() + opts.timeoutMs;
  let last: unknown;
  while (Date.now() < deadline) {
    try {
      const v = await fn();
      if (v) return v;
      last = v;
    } catch (e) {
      last = e;
    }
    await new Promise((r) => setTimeout(r, opts.intervalMs));
  }
  throw new Error(
    `pollUntil timed out${opts.label ? ` [${opts.label}]` : ''} after ${opts.timeoutMs}ms (last=${JSON.stringify(last)})`,
  );
}

/** 收集该用户在 Stripe 侧建的对象（供外部清理），再按外键顺序删本地行。 */
export async function cleanupUser(
  prisma: any,
  userId: string,
): Promise<{ subscriptionId?: string; customerId?: string }> {
  const membership = await prisma.user_memberships
    .findUnique({ where: { userId } })
    .catch(() => null);
  const stripeRefs = {
    subscriptionId: membership?.stripeSubscriptionId ?? undefined,
    customerId: membership?.stripeCustomerId ?? undefined,
  };

  // 按外键安全顺序删除，仅限该用户；每步独立 try/catch，避免个别表缺列时中断整体清理。
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['payment_events', () => prisma.payment_events.deleteMany({ where: { userId } })],
    ['points_records', () => prisma.points_records.deleteMany({ where: { userId } })],
    ['point_grants', () => prisma.point_grants.deleteMany({ where: { userId } })],
    ['user_points', () => prisma.user_points.deleteMany({ where: { userId } })],
    ['user_memberships', () => prisma.user_memberships.deleteMany({ where: { userId } })],
    ['orders', () => prisma.orders.deleteMany({ where: { userId } })],
    ['userSession', () => prisma.userSession.deleteMany({ where: { userId } })],
    ['user', () => prisma.user.delete({ where: { id: userId } })],
  ];
  for (const [name, run] of steps) {
    try {
      await run();
    } catch (e: any) {
      console.warn(`[cleanup] ${name} for ${userId} failed: ${e.message}`);
    }
  }
  return stripeRefs;
}
