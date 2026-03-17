// playwright.config.js
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // extensions require serial execution
  use: {
    headless: false, // extensions don't load headless
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
