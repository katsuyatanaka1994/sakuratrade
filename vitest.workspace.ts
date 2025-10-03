import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineWorkspace } from 'vitest/config';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineWorkspace([
  path.join(rootDir, 'frontend', 'vitest.config.ts'),
]);
