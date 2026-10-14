import { defineConfig } from '@playwright/test'

export default defineConfig({
  globalTimeout: 60000,
  testDir: './e2e',
  outputDir: './e2e/.results',
  use: {
    baseURL:
      process.env.E2E_BASE_URL ?? `http://127.0.0.1:4173${process.env.VITE_BASE_PATH ?? '/'}`,
    browserName: 'chromium',
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command:
          'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173 --strictPort',
        timeout: 30000,
        gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
        url: `http://127.0.0.1:4173${process.env.VITE_BASE_PATH ?? '/'}`,
        reuseExistingServer: true,
      },
})
