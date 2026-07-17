/**
 * E2E 测试的固定参数。产品 ID 为数据库种子中的有效条目。
 */
export const E2E = {
  port: Number(process.env.E2E_PORT ?? 4599),
  get baseUrl() {
    return `http://localhost:${E2E.port}/api`;
  },
  webhookPath: '/api/payments/webhooks/stripe',
  // 可购买产品（数据库种子）
  membershipPlanId: 'cmqwbsxsg0003z49k0dalu1e3', // MONTHLY Plus 19.9 USD / 11000 pts
  membershipPlanPoints: 11000,
  pointsPackageId: 'cmqwbsxsz0009z49krq3opfjx', // 体验包 9.9 USD / 800 pts
  pointsPackagePoints: 800,
  // Stripe 测试卡
  testCard: {
    number: '4242424242424242',
    exp: '12 / 34',
    cvc: '123',
    name: 'E2E Tester',
    zip: '42424',
    phone: '2015550123',
  },
  // 异步 webhook 落库轮询
  poll: { timeoutMs: 60_000, intervalMs: 1_500 },
  serverReadyTimeoutMs: 60_000,
} as const;
