import { defineConfig } from 'vitest/config';

// Projects are listed explicitly so Vitest never auto-discovers the dashboard's vite
// config. The dashboard project below is deliberately narrow: pure logic in src/content
// only, in a node environment, so no DOM or JSX setup is pulled in.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'backend',
          root: import.meta.dirname,
          environment: 'node',
          include: [
            'packages/**/*.test.ts',
            'apps/api/**/*.test.ts',
            'apps/smtp-ingress/**/*.test.ts',
            'apps/worker/**/*.test.ts',
          ],
          exclude: ['**/node_modules/**', '**/dist/**'],
          setupFiles: ['./test/setup.ts'],
          testTimeout: 60_000,
        },
      },
      {
        test: {
          name: 'dashboard-logic',
          root: import.meta.dirname,
          environment: 'node',
          include: ['apps/dashboard/src/content/**/*.test.ts'],
          exclude: ['**/node_modules/**', '**/dist/**'],
        },
      },
    ],
  },
});
