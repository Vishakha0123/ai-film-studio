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

for (const provider of ['google', 'apple'] as const) {
test(`Supabase ${provider} sign-in → OAuth redirect → backend verifies the access token → project is created for that user`, async ({ page }) => {
  await preparePage(page)
  const userId = randomUUID()
  const email = `${provider}-director@vrutsa.in`
  const token = supabaseJwt(userId, email)
  const user = { id: userId, aud: 'authenticated', role: 'authenticated', email, app_metadata: { provider }, user_metadata: {}, created_at: new Date().toISOString() }
  let requestedProvider = ''

  // Supabase's /authorize normally bounces through Google/Apple; here it redirects straight back with a session.
  await page.route(`${FAKE_SUPABASE}/auth/v1/authorize**`, async route => {
    const url = new URL(route.request().url())
    requestedProvider = url.searchParams.get('provider') ?? ''
    const back = url.searchParams.get('redirect_to')!
    const expiresAt = Math.floor(Date.now() / 1000) + 3600
    await route.fulfill({ status: 302, headers: { location: `${back}#access_token=${token}&refresh_token=r&expires_in=3600&expires_at=${expiresAt}&token_type=bearer` } })
  })
  await page.route(`${FAKE_SUPABASE}/auth/v1/user**`, route => route.fulfill({ json: user }))

  await page.goto('/login')
  await expect(page.getByLabel(/password/i)).toHaveCount(0)
  await page.getByRole('button', { name: `Continue with ${provider === 'google' ? 'Google' : 'Apple'}` }).click()
  await expect(page.getByTestId('screen-onboarding')).toBeVisible()
  expect(requestedProvider).toBe(provider)
  await expect(page).toHaveURL(/\/onboarding#?$/) // tokens are cleared from the address bar

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
  expect(me).toMatchObject({ id: userId, email })

  // A forged token is rejected
  const forged = await page.evaluate(async api => (await fetch(`${api}/api/v1/projects`, { headers: { Authorization: 'Bearer dev:attacker@x.io' } })).status, 'http://localhost:8011')
  expect(forged).toBe(401)
})
}
