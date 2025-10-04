import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        extends: './frontend/vitest.config.ts',
        test: {
          root: './frontend',
        },
      },
    ],
  },
});
