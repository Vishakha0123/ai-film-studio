/**
 * Full-stack E2E: real FastAPI backend (dev auth, SQLite, mock AI providers) + frontend in live mode.
 *   npx playwright test -c playwright.live.config.ts
 */
import { defineConfig, devices } from '@playwright/test'

const API = 'http://localhost:8010'
const WEB = 'http://localhost:4180'
const chromiumPath = process.env.PW_CHROMIUM_PATH
const launchOptions = chromiumPath ? { executablePath: chromiumPath } : {}
const python = process.env.BACKEND_PYTHON ?? '.venv/bin/python'

export default defineConfig({
  testDir: './e2e',
  testMatch: /live\.spec\.ts/,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, baseURL: WEB, launchOptions, trace: 'retain-on-failure' },
  webServer: [
    {
      command: `rm -rf .e2e && mkdir -p .e2e && ${python} -m alembic upgrade head && ${python} -m uvicorn app.main:app --port 8010`,
      cwd: '../backend',
      url: `${API}/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        AUTH_MODE: 'dev',
        DATABASE_URL: 'sqlite:///./.e2e/e2e.db',
        LOCAL_MEDIA_DIR: './.e2e/media',
        PUBLIC_BASE_URL: API,
        CORS_ORIGINS: `["${WEB}"]`,
        STORY_PROVIDER: 'mock', IMAGE_PROVIDER: 'mock', VIDEO_PROVIDER: 'mock', TTS_PROVIDER: 'mock',
        REDIS_URL: '',
      },
    },
    {
      command: `npx vite build --outDir .e2e-dist && npx vite preview --outDir .e2e-dist --port 4180 --strictPort`,
      url: WEB,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { VITE_API_URL: API, VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
    },
  ],
})
