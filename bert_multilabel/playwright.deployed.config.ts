import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  workers: 1,
  reporter: [
    ['line'],
    ['html', { outputFolder: 'playwright-report-deployed', open: 'never' }],
  ],
  use: {
    baseURL: 'https://prototype.d1shchw5gp0ozh.amplifyapp.com/',
    headless: true,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
