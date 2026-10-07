/**
 * Supabase Auth integration E2E: frontend uses supabase-js (auth endpoint stubbed in the browser),
 * backend runs AUTH_MODE=supabase and verifies the HS256-signed access token.
 *   npx playwright test -c playwright.supabase.config.ts
 */
import { defineConfig, devices } from '@playwright/test'

const API = 'http://localhost:8011'
const WEB = 'http://localhost:4181'
export const FAKE_SUPABASE = 'http://supabase.test'
export const JWT_SECRET = 'e2e-only-jwt-secret-that-is-long-enough-123'
const chromiumPath = process.env.PW_CHROMIUM_PATH
const launchOptions = chromiumPath ? { executablePath: chromiumPath } : {}
const python = process.env.BACKEND_PYTHON ?? '.venv/bin/python'

export default defineConfig({
  testDir: './e2e',
  testMatch: /supabase\.spec\.ts/,
  timeout: 90_000,
  reporter: [['list']],
  use: { ...devices['Desktop Chrome'], baseURL: WEB, launchOptions },
  webServer: [
    {
      command: `rm -rf .e2e-sb && mkdir -p .e2e-sb && ${python} -m alembic upgrade head && ${python} -m uvicorn app.main:app --port 8011`,
      cwd: '../backend',
      url: `${API}/health`,
      reuseExistingServer: false,
      env: {
        AUTH_MODE: 'supabase', SUPABASE_URL: FAKE_SUPABASE, SUPABASE_JWT_SECRET: JWT_SECRET,
        DATABASE_URL: 'sqlite:///./.e2e-sb/e2e.db', LOCAL_MEDIA_DIR: './.e2e-sb/media', PUBLIC_BASE_URL: API,
        CORS_ORIGINS: `["${WEB}"]`, REDIS_URL: '',
      },
    },
    {
      command: `npx vite build --outDir .e2e-dist-sb && npx vite preview --outDir .e2e-dist-sb --port 4181 --strictPort`,
      url: WEB,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { VITE_API_URL: API, VITE_SUPABASE_URL: FAKE_SUPABASE, VITE_SUPABASE_ANON_KEY: 'public-anon-key' },
    },
  ],
})
