import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // shared-ui's tsconfig sets jsx: "preserve" (Next compiles the JSX downstream),
  // which leaves raw JSX that Vite cannot parse on its own. bun transformed it
  // natively; under vitest the React plugin has to do it — same as clients/web.
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['test/**/*.test.{ts,tsx}'],
  },
});
