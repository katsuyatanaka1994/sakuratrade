import { defineConfig, mergeConfig } from 'vitest/config';
import frontendConfig from './frontend/vitest.config';

export default mergeConfig(frontendConfig, defineConfig({
  test: {
    root: './frontend',
  },
}));
