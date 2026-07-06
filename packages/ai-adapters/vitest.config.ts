import { defineConfig } from 'vitest/config';

// 只在 src 下发现测试，排除构建产物 dist（否则编译出的 .spec.js 会被 vitest 4 误当作用例）。
export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
