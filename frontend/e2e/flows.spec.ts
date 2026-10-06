import { test, expect } from '@playwright/test'
import { preparePage, signIn, runDirector, STAGES } from './helpers'

test.beforeEach(async ({ page }) => {
  await preparePage(page)
})

test('end-to-end: idea → story → all stages → teaser → export', async ({ page }) => {
  test.setTimeout(180_000)
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))

  // Landing
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Turn Your Ideas/ })).toBeVisible()
  await page.getByRole('button', { name: 'Create With AI' }).click()

  // Auth
  await expect(page).toHaveURL(/\/login$/)
  await signIn(page)

  // Onboarding
  await page.getByRole('button', { name: /Horror/ }).click()
  await page.getByRole('button', { name: /Thriller/ }).click()
  await page.getByRole('button', { name: 'Continue with Horror & Thriller' }).click()
  await expect(page).toHaveURL(/\/director$/)

  // Locked stages before any story exists
  await expect(page.getByTestId('nav-story')).toHaveAttribute('aria-disabled', 'true')

  // AI Director conversation drives every stage
  await runDirector(page)
  for (const stage of [...STAGES, 'music'] as const) {
    await expect(page.getByTestId(`nav-${stage}`)).toHaveAttribute('aria-disabled', 'false')
  }

  // Deep links work for unlocked panels
  await page.getByTestId('nav-storyboard').click()
  await expect(page).toHaveURL(/\/director\/storyboard$/)
  await page.getByRole('button', { name: 'Anime' }).click()
  await expect(page.getByText('Visual style: Anime')).toBeVisible()

  // Chat history survives switching panels
  await page.getByTestId('nav-chat').click()
  await expect(page.getByTestId('card-story')).toBeVisible()
  await expect(page.getByTestId('card-generate')).toBeVisible()

  // Generate teaser
  await page.getByTestId('card-generate').getByRole('button', { name: 'Generate ▶' }).click()
  await expect(page).toHaveURL(/\/generation$/)
  await expect(page.getByTestId('screen-generation')).toBeVisible()
  await expect(page.getByText('Generating', { exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/teaser$/, { timeout: 20_000 })

  // Teaser player
  await page.getByRole('button', { name: 'Play' }).click()
  await expect(page.getByTestId('teaser-time')).not.toHaveText('0s / 10s', { timeout: 3000 })
  await page.getByRole('button', { name: 'Pause' }).click()

  // Export
  await page.getByRole('button', { name: 'Export' }).click()
  await expect(page).toHaveURL(/\/export$/)
  await page.getByRole('button', { name: /1:1 1080×1080/ }).click()
  await page.getByRole('button', { name: 'Export 1:1 · 1080' }).click()
  await expect(page.getByText('Your Teaser Is Ready.')).toBeVisible({ timeout: 6000 })
  await page.getByRole('button', { name: 'New Film' }).click()
  await expect(page).toHaveURL(/\/$/)

  expect(errors).toEqual([])
})

test('auth guard redirects to login, and session persists across reload', async ({ page }) => {
  await page.goto('/director')
  await expect(page).toHaveURL(/\/login$/)
  await signIn(page)
  await page.goto('/director')
  await expect(page.getByTestId('screen-director')).toBeVisible()
  await page.reload()
  await expect(page.getByTestId('screen-director')).toBeVisible()
})

test('locked panel deep links fall back to the Director chat', async ({ page }) => {
  await signIn(page)
  await page.goto('/director/screenplay')
  await expect(page).toHaveURL(/\/director$/)
  await expect(page.getByTestId('panel-chat')).toBeVisible()
})
