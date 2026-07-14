import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // renderToStaticMarkup only needs the server renderer — no DOM required.
    environment: 'node',
    globals: true,
    include: ['test/**/*.spec.{ts,tsx}'],
  },
});
