import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.js', 'proxy/tests/**/*.test.js'],
    coverage: {
      include: [
        'src/**/*.js',
        'proxy/src/**/*.js',
      ],
      exclude: [
        'src/content/index.js',
      ],
    },
  },
});
