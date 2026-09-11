import { defineConfig } from '@playwright/test';
import { randomUUID } from 'node:crypto';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5174',
    channel: 'msedge',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --port 5174',
    url: 'http://127.0.0.1:5174/api/health',
    reuseExistingServer: false,
    env: {
      PORT: '3102',
      HOST: '127.0.0.1',
      DEV_HOST: '127.0.0.1',
      APP_ORIGINS: 'http://127.0.0.1:5174',
      DATABASE_PATH: `.artifacts/e2e-${randomUUID()}.sqlite`,
      COOKIE_SECURE: 'false',
      NODE_ENV: 'test',
    },
    timeout: 60_000,
  },
});
