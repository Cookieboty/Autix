/**
 * Stripe 支付 / 积分 / 订阅端到端测试（真实 Stripe test-mode）。
 *
 * 测试进程用独立 Prisma 造一次性用户并签发 JWT；真实编译产物 node dist/main.js 以子进程运行；
 * Stripe CLI（stripe listen）把真实 test-mode webhook 转发到 /api/payments/webhooks/stripe；
 * Playwright 无头驱动 Stripe 托管 Checkout。三个用例共享同一用户，按业务依赖顺序执行
 * （积分包购买要求已有有效会员）：
 *   1) 订阅会员 → 会员激活 + 月度积分发放
 *   2) 购买积分包 → 积分入账
 *   3) 到期取消订阅
 *
 * 前置：
 *   - pnpm --filter @autix/api build（跑真实 dist）
 *   - Stripe CLI 已登录 test-mode 账号
 *   - DATABASE_URL 指向已迁移的本地数据库
 * 运行：pnpm --filter @autix/api test:e2e
 *
 * 所有写入以一次性用户为界；afterAll 只删除该用户的行与本次创建的 Stripe 对象，不 truncate 表。
 */
import { E2E } from './harness/config';
import { makePrisma, createTestUser, pollUntil, withRetry, cleanupUser, type TestUser } from './harness/db';
import { getWebhookSecret, startForwarding, cleanupStripe, type ForwardHandle } from './harness/stripe-cli';
import { startServer, type ServerHandle } from './harness/server';
import { apiClient } from './harness/api';
import { payHostedCheckout, payWithRetry } from './harness/checkout';

describe('Stripe 一条龙 e2e（真实 test-mode）', () => {
  const prisma: any = makePrisma();
  let server: ServerHandle;
  let forward: ForwardHandle;
  let user: TestUser;
  let api: ReturnType<typeof apiClient>;

  beforeAll(async () => {
    const secret = await getWebhookSecret();
    server = await startServer(secret);
    forward = await startForwarding(`http://localhost:${E2E.port}${E2E.webhookPath}`);
    user = await createTestUser(prisma);
    api = apiClient(user.token);
  });

  afterAll(async () => {
    try {
      if (user) {
        const refs = await cleanupUser(prisma, user.userId);
        await cleanupStripe(refs);
      }
    } finally {
      forward?.stop();
      server?.stop();
      await prisma.$disconnect();
    }
  });

  async function checkoutAndPay(body: { orderType: string; productId: string }) {
    const res = await api.post('/orders/checkout/stripe', body);
    expect(res.status).toBeLessThan(400);
    const checkoutUrl: string | undefined = res.data?.checkoutUrl;
    expect(checkoutUrl, `no checkoutUrl: ${JSON.stringify(res.raw)}`).toBeTruthy();
    // 成功判定以随后对 DB 履约结果的轮询为准，不依赖浏览器是否离开 Stripe 页。
    await payHostedCheckout(checkoutUrl!, `${user.username}@e2e.local`);
  }

  it('订阅会员：支付成功 → 会员激活 + 月度积分发放', async () => {
    await checkoutAndPay({ orderType: 'MEMBERSHIP', productId: E2E.membershipPlanId });

    const membership = await pollUntil(
      async () => {
        const m = await prisma.user_memberships.findUnique({ where: { userId: user.userId } });
        return m && m.status === 'ACTIVE' ? m : null;
      },
      { ...E2E.poll, label: 'membership ACTIVE' },
    );
    expect(membership.status).toBe('ACTIVE');
    expect(membership.stripeSubscriptionId).toBeTruthy(); // 订阅 webhook 已回填
    expect(membership.stripeCustomerId).toBeTruthy();

    const points = await pollUntil(
      async () => {
        const p = await prisma.user_points.findUnique({ where: { userId: user.userId } });
        return p && Number(p.balance) >= E2E.membershipPlanPoints ? p : null;
      },
      { ...E2E.poll, label: 'membership points granted' },
    );
    expect(Number(points.balance)).toBeGreaterThanOrEqual(E2E.membershipPlanPoints);
  });

  // 积分包为 payment 模式，托管页含多种支付方式，渲染时序不稳定；用 fresh 会话重试直到某次渲染成功。
  it('已开通会员后购买积分包：支付成功 → 积分入账', async () => {
    const before = await withRetry(() =>
      prisma.user_points.findUnique({ where: { userId: user.userId } }),
    );
    const baseline = Number(before?.balance ?? 0);

    await payWithRetry(
      async () => {
        const res = await api.post('/orders/checkout/stripe', {
          orderType: 'POINTS_PACKAGE', productId: E2E.pointsPackageId,
        });
        expect(res.status).toBeLessThan(400);
        const url: string | undefined = res.data?.checkoutUrl;
        expect(url, `no checkoutUrl: ${JSON.stringify(res.raw)}`).toBeTruthy();
        return url!;
      },
      `${user.username}@e2e.local`,
      { attempts: 8, renderBudgetMs: 45_000 },
    );

    const points = await pollUntil(
      async () => {
        const p = await prisma.user_points.findUnique({ where: { userId: user.userId } });
        return p && Number(p.balance) >= baseline + E2E.pointsPackagePoints ? p : null;
      },
      { ...E2E.poll, label: 'points-package granted' },
    );
    expect(Number(points.balance)).toBe(baseline + E2E.pointsPackagePoints);
  });

  it('到期取消订阅：会员置为期末取消（账期内仍有效）', async () => {
    const res = await api.post('/membership/cancel-at-period-end');
    expect(res.status).toBeLessThan(400);

    const membership = await pollUntil(
      async () => {
        const m = await prisma.user_memberships.findUnique({ where: { userId: user.userId } });
        return m && m.cancelAtPeriodEnd === true ? m : null;
      },
      { ...E2E.poll, label: 'cancelAtPeriodEnd' },
    );
    expect(membership.cancelAtPeriodEnd).toBe(true);
    expect(membership.autoRenew).toBe(false);
    expect(membership.status).toBe('ACTIVE'); // 期末取消：账期内仍是有效会员
  });
});
