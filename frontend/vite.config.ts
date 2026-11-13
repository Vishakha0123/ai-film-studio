/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// A live (Vercel production) build without these would quietly become the offline demo — stop it instead.
const LIVE_SETTINGS = ['VITE_API_URL', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']

export default defineConfig(({ mode }) => {
  if (process.env.VERCEL_ENV === 'production') {
    const env = loadEnv(mode, process.cwd(), 'VITE_')
    const missing = LIVE_SETTINGS.filter(k => !env[k])
    if (missing.length) throw new Error(`Live build is missing ${missing.join(', ')} — add them in Vercel → Settings → Environment Variables.`)
    if (!env.VITE_API_URL.startsWith('https://')) throw new Error('VITE_API_URL must be the https address of the backend.')
  }
  return config
})

const config = {
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: { port: 5173 },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
}
