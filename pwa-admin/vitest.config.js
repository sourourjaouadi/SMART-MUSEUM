import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.component.test.jsx', 'src/**/*.test.js'],
    // Service-layer tests ending in .node.test.js run with `node --test`.
    exclude: ['**/node_modules/**', 'src/**/*.node.test.js'],
    restoreMocks: true,
  },
});
