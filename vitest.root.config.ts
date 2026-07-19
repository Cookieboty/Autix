import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Root-level specs (scripts/**/__tests__), run explicitly via `--config`.
// Deliberately NOT named vitest.config.ts: vitest searches parent directories
// for a config, so a root-level one would hijack every workspace package that
// doesn't ship its own (packages/domain, packages/sdk).
export default defineConfig({
  resolve: {
    alias: {
      // `scripts/check-i18n-consistency.ts` imports `clients/web/lib/i18n/route-policy.ts`,
      // which resolves `@/i18n/routing` via the Next app's tsconfig `paths`. Vitest does
      // not read that tsconfig, so without this alias the import throws at module load and
      // the whole suite errors out before a single test runs.
      '@': fileURLToPath(new URL('./clients/web', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    // Both `scripts/__tests__/` and nested `scripts/*/__tests__/`, and both
    // extensions: `check-i18n-consistency.test.ts` sat outside the old
    // `scripts/__tests__/**/*.spec.ts` glob on both counts, so `pnpm test`
    // silently never ran it.
    include: ['scripts/**/__tests__/**/*.{test,spec}.ts'],
  },
});
