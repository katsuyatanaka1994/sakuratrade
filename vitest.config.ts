import { defineConfig, defineProject } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      defineProject({
        extends: './frontend/vitest.config.ts',
      }),
    ],
  },
});
