import { test, expect } from '@playwright/test'
import { preparePage, signIn, runDirector, STAGES } from './helpers'

test.beforeEach(async ({ page }) => {
  await preparePage(page)
})

test('end-to-end: idea → story → every open stage → Coming-soon features are locked → New Film', async ({ page }) => {
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

  // Audio, Music and Generate Teaser are Coming soon; every other stage is open
  for (const p of ['audio', 'music']) {
    await expect(page.getByTestId(`nav-${p}`)).toHaveAttribute('aria-disabled', 'true')
    await expect(page.getByTestId(`nav-${p}`)).toContainText('Soon')
  }
  await expect(page.getByTestId('topbar-generate')).toHaveAttribute('aria-disabled', 'true')

  // AI Director conversation drives every open stage
  await runDirector(page)
  for (const stage of STAGES) {
    await expect(page.getByTestId(`nav-${stage}`)).not.toHaveAttribute('aria-disabled', 'true')
  }

  // Deep links work for open panels
  await page.getByTestId('nav-storyboard').click()
  await expect(page).toHaveURL(/\/director\/storyboard$/)
  await page.getByRole('button', { name: 'Anime' }).click()
  await expect(page.getByText('Visual style: Anime')).toBeVisible()
  await expect(page.getByRole('button', { name: /Generate Visuals & Video/ })).toHaveAttribute('aria-disabled', 'true')

  // Last chat step offers generation as Coming soon and stays in the chat
  await page.getByTestId('nav-chat').click()
  await page.getByLabel('Message the AI Director').fill('continue')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('card-generate')).toBeVisible()
  await expect(page.getByText(/Teaser generation is coming soon/)).toBeVisible()
  await expect(page.getByTestId('card-generate').getByRole('button', { name: /Generate/ })).toBeDisabled()
  await page.getByTestId('card-generate').getByRole('button', { name: /Generate/ }).click({ force: true })
  await expect(page).toHaveURL(/\/director$/)
  await expect(page.getByTestId('card-story')).toBeVisible() // chat history kept
  await expect(page.getByTestId('sidebar-generate')).toHaveAttribute('aria-disabled', 'true')

  // Locked screens can't be opened by URL
  for (const path of ['/director/audio', '/director/music', '/generation', '/teaser', '/export']) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/director$/)
  }

  // New Film → pick a genre → a clean Director chat
  await page.getByRole('button', { name: 'New Film' }).click()
  await expect(page).toHaveURL(/\/new$/)
  await page.getByRole('button', { name: /Sci-Fi/ }).click()
  await page.getByRole('button', { name: 'Start Sci-Fi film' }).click()
  await expect(page).toHaveURL(/\/director$/)
  await expect(page.getByTestId('panel-chat')).toContainText("Let's make a new Sci-Fi film")

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
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await expect(page).toHaveURL(/\/projects\/demo$/)
  await expect(page.getByTestId('overview-shot')).toHaveCount(4)
  await page.getByRole('link', { name: 'Storyboard' }).click()
  await expect(page.getByTestId('overview-storyboard')).toBeInViewport()
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
