import { defineConfig } from 'vitest/config';

// 真实 Stripe test-mode 一条龙 e2e。与单测（src/**/*.spec.ts）完全隔离：
// 只跑 e2e/**/*.e2e.ts，串行、单进程、放大超时（真实网络 + 异步 webhook）。
// 通过 package.json 的 test:e2e 以 `dotenv -e ../../.env -- vitest run --config vitest.e2e.config.ts` 运行，
// 以便 JWT_SECRET / DATABASE_URL / STRIPE_SECRET_KEY 等注入测试进程。
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['e2e/**/*.e2e.ts'],
    testTimeout: 600_000,
    hookTimeout: 180_000,
    fileParallelism: false,
    sequence: { concurrent: false },
    pool: 'forks',
    retry: 0,
  },
});
