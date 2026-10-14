import { defineConfig } from '@playwright/test'

export default defineConfig({
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
        command: 'pnpm exec vite preview --host 127.0.0.1 --port 4173 --strictPort',
        url: `http://127.0.0.1:4173${process.env.VITE_BASE_PATH ?? '/'}`,
        reuseExistingServer: true,
      },
})
