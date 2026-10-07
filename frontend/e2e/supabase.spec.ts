import { test, expect } from '@playwright/test'
import { createHmac, randomUUID } from 'node:crypto'
import { FAKE_SUPABASE, JWT_SECRET } from '../playwright.supabase.config'
import { preparePage } from './helpers'

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
function supabaseJwt(sub: string, email: string) {
  const now = Math.floor(Date.now() / 1000)
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, email, aud: 'authenticated', role: 'authenticated', iss: `${FAKE_SUPABASE}/auth/v1`, iat: now, exp: now + 3600 })}`
  return `${body}.${createHmac('sha256', JWT_SECRET).update(body).digest('base64url')}`
}

test('Supabase email sign-in → backend verifies the access token → project is created for that user', async ({ page }) => {
  await preparePage(page)
  const userId = randomUUID()
  let anonKeySent = ''
  await page.route(`${FAKE_SUPABASE}/auth/v1/token**`, async route => {
    anonKeySent = route.request().headers()['apikey'] ?? ''
    const { email } = route.request().postDataJSON()
    const token = supabaseJwt(userId, email)
    await route.fulfill({
      json: {
        access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: 'r', user: { id: userId, aud: 'authenticated', role: 'authenticated', email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
      },
    })
  })

  await page.goto('/login')
  await page.getByLabel('Email address').fill('sheerap@vrutsa.in')
  await page.getByLabel('Password').fill('correct horse')
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page.getByTestId('screen-onboarding')).toBeVisible()
  expect(anonKeySent).toBe('public-anon-key')

  await page.getByRole('button', { name: 'Skip', exact: true }).click()
  await page.getByLabel('Message the AI Director').fill('A monsoon love story in Chennai')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('panel-story')).toBeVisible({ timeout: 20_000 })

  // The backend saw a verified Supabase user: /me returns the token's identity
  const me = await page.evaluate(async api => {
    const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))!
    const token = JSON.parse(localStorage.getItem(key)!).access_token
    return (await fetch(`${api}/api/v1/me`, { headers: { Authorization: `Bearer ${token}` } })).json()
  }, 'http://localhost:8011')
  expect(me).toEqual({ id: userId, email: 'sheerap@vrutsa.in' })

  // A forged token is rejected
  const forged = await page.evaluate(async api => (await fetch(`${api}/api/v1/projects`, { headers: { Authorization: 'Bearer dev:attacker@x.io' } })).status, 'http://localhost:8011')
  expect(forged).toBe(401)
})
