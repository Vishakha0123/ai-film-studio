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

  // No locked stages
  await expect(page.locator('[aria-disabled="true"]')).toHaveCount(0)

  // AI Director conversation drives every stage
  await runDirector(page)
  for (const stage of [...STAGES, 'music'] as const) {
    await expect(page.getByTestId(`nav-${stage}`)).toBeEnabled()
  }

  // Deep links work for every panel
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
  // New Film → pick a genre → a clean Director chat
  await page.getByRole('button', { name: 'New Film' }).click()
  await expect(page).toHaveURL(/\/new$/)
  await expect(page.getByTestId('new-film-note')).toContainText('Echoes of the Forgotten')
  await page.getByRole('button', { name: /Sci-Fi/ }).click()
  await page.getByRole('button', { name: 'Start Sci-Fi film' }).click()
  await expect(page).toHaveURL(/\/director$/)
  await expect(page.getByTestId('panel-chat')).toContainText("Let's make a new Sci-Fi film")
  await expect(page.getByTestId('panel-chat')).not.toContainText('A grieving composer')

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

test('any panel opens directly from a deep link', async ({ page }) => {
  await signIn(page)
  await page.goto('/director/screenplay')
  await expect(page).toHaveURL(/\/director\/screenplay$/)
  await expect(page.getByTestId('panel-screenplay')).toBeVisible()
})

test('workspace pages: projects, assets, settings', async ({ page }) => {
  await signIn(page)
  await page.goto('/director')
  await page.getByTestId('nav-projects').click()
  await expect(page).toHaveURL(/\/projects$/)
  await expect(page.getByTestId('project-card')).toHaveCount(1)
  await page.getByTestId('nav-assets').click()
  await expect(page.getByTestId('asset-card')).toHaveCount(7)
  await page.getByTestId('nav-settings').click()
  await expect(page.getByText('Creative defaults')).toBeVisible()
})

test('chat input controls are vertically aligned and the textarea grows', async ({ page }) => {
  await preparePage(page)
  await signIn(page)
  await page.goto('/director')
  const box = page.getByLabel('Message the AI Director')
  const centers = async () => Promise.all(
    [page.getByRole('button', { name: 'Attach files' }), box, page.getByTestId('mic-button'), page.getByRole('button', { name: 'Send' })]
      .map(async l => { const b = (await l.boundingBox())!; return b.y + b.height / 2 }),
  )
  const c = await centers()
  for (const y of c) expect(Math.abs(y - c[0])).toBeLessThanOrEqual(1)
  const h1 = (await box.boundingBox())!.height
  await box.fill('line 1\nline 2\nline 3\nline 4')
  expect((await box.boundingBox())!.height).toBeGreaterThan(h1 + 20)
})
