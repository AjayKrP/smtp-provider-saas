import { defineConfig } from 'vitest/config';

// Single explicit project so Vitest does not auto-discover the dashboard's vite config.
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
    ],
  },
});
