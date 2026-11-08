import { defineConfig } from 'vitest/config';

// Só testamos código sem React Native (ex.: src/cardApi.ts).
export default defineConfig({ test: { include: ['test/**/*.test.ts'] } });
