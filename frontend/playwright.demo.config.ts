/**
 * Records the home page's "Watch Demo" video from the real app (backend with the mock AI providers + frontend,
 * locked features as users see them). See scripts/record-demo.mjs — run `npm run demo:record`.
 */
import { defineConfig, devices } from '@playwright/test'

const API = 'http://localhost:8011'
const WEB = 'http://localhost:4181'
const chromiumPath = process.env.PW_CHROMIUM_PATH
const launchOptions = chromiumPath ? { executablePath: chromiumPath } : {}
const python = process.env.BACKEND_PYTHON ?? '.venv/bin/python'

export default defineConfig({
  testDir: './e2e',
  testMatch: /record-demo\.demo\.ts/,
  outputDir: '.demo-results',
  timeout: 300_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 }, baseURL: WEB, launchOptions, video: { mode: 'on', size: { width: 1280, height: 720 } } },
  webServer: [
    {
      command: `rm -rf .e2e-demo && mkdir -p .e2e-demo/portraits && cp portraits/*.jpg .e2e-demo/portraits/ && ${python} -m alembic upgrade head && ${python} -m uvicorn app.main:app --port 8011`,
      cwd: '../backend',
      url: `${API}/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        AUTH_MODE: 'dev',
        DATABASE_URL: 'sqlite:///./.e2e-demo/demo.db',
        LOCAL_MEDIA_DIR: './.e2e-demo/media',
        REFERENCE_PORTRAITS_DIR: './.e2e-demo/portraits',
        PUBLIC_BASE_URL: API,
        CORS_ORIGINS: `["${WEB}"]`,
        STORY_PROVIDER: 'mock', IMAGE_PROVIDER: 'mock', VIDEO_PROVIDER: 'mock', TTS_PROVIDER: 'mock',
        REDIS_URL: '',
      },
    },
    {
      command: `npx vite build --outDir .e2e-demo-dist && npx vite preview --outDir .e2e-demo-dist --port 4181 --strictPort`,
      url: WEB,
      reuseExistingServer: false,
      timeout: 120_000,
      // Locked features stay locked, exactly as users see the app.
      env: { VITE_API_URL: API, VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '', VITE_UNLOCK_PREVIEW: 'false' },
    },
  ],
})
