import { defineConfig } from 'vitest/config';

// Root-level specs (scripts/__tests__), run explicitly via `--config`.
// Deliberately NOT named vitest.config.ts: vitest searches parent directories
// for a config, so a root-level one would hijack every workspace package that
// doesn't ship its own (packages/domain, packages/sdk).
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['scripts/__tests__/**/*.spec.ts'],
  },
});
