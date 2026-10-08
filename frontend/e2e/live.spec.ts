import { test, expect } from '@playwright/test'
import { preparePage } from './helpers'

const API = 'http://localhost:8010'

test('full stack: login → plan with AI → generate assets → teaser → render explains missing video', async ({ page, request }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await preparePage(page)

  // Dev login through the backend (Google button → local Google test user)
  await page.goto('/login')
  await expect(page.getByText('Dev login — each button signs in a local test user')).toBeVisible()
  await expect(page.getByLabel(/email/i)).toHaveCount(0)
  await page.getByRole('button', { name: 'Continue with Google' }).click()
  await expect(page.getByTestId('screen-onboarding')).toBeVisible()
  await page.getByRole('button', { name: /Horror/ }).click()
  await page.getByRole('button', { name: 'Continue with Horror' }).click()

  // First idea → POST /projects, /brief, /plan → poll /jobs/{id}
  await page.getByLabel('Message the AI Director').fill('A grieving composer hears messages in her late husband\'s symphony')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('panel-story')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('heading', { name: 'Echoes of the Forgotten' })).toBeVisible()

  // The project really exists in the backend, owned by this user
  const auth = { Authorization: 'Bearer dev:google-user@dev.local' }
  const projects = await (await request.get(`${API}/api/v1/projects`, { headers: auth })).json()
  expect(projects).toHaveLength(1)
  expect(projects[0].genre).toBe('Horror')

  // Story action runs an edit job on the backend
  await page.getByRole('button', { name: 'Make Darker' }).click()
  await expect(page.getByTestId('story-working')).toBeHidden({ timeout: 15_000 })
  await expect(page.getByText('[Revised: Make the story darker and more unsettling.]')).toBeVisible()

  // Walk the rest of the Director flow
  for (const stage of ['characters', 'screenplay', 'dialogue', 'lyrics', 'scenes', 'storyboard', 'audio']) {
    await page.getByTestId('nav-chat').click()
    await page.getByLabel('Message the AI Director').fill('continue')
    await page.keyboard.press('Enter')
    await expect(page.getByTestId(`panel-${stage}`)).toBeVisible({ timeout: 10_000 })
  }

  // Generate → estimate → job → assets → teaser
  await page.getByTestId('nav-chat').click()
  await page.getByTestId('card-generate').getByRole('button', { name: 'Generate ▶' }).click()
  await expect(page.getByTestId('screen-generation')).toBeVisible()
  await expect(page).toHaveURL(/\/teaser$/, { timeout: 30_000 })

  const project = await (await request.get(`${API}/api/v1/projects/${projects[0].id}`, { headers: auth })).json()
  const frame = project.memory.shots[0].imageUrl as string
  expect(frame).toMatch(/^http:\/\/localhost:8010\/media\/projects\/.+\/storyboard_image\/1-v1\.svg$/)
  // The teaser shows the generated storyboard frame from the backend
  await expect(page.getByTestId('teaser-player').locator('img')).toHaveAttribute('src', frame)
  // Export → render job → backend explains that video clips are needed (mock video provider)
  await page.getByRole('button', { name: 'Export' }).click()
  await page.getByRole('button', { name: 'Export 16:9 · 1080' }).click()
  await expect(page.getByRole('alert')).toContainText('Every shot needs a ready video clip', { timeout: 15_000 })

  // Reload keeps the project: all stages open, generated portraits shown
  await page.goto('/director')
  await expect(page.getByText('is open — pick any stage')).toBeVisible()
  await page.getByTestId('nav-characters').click()
  const portrait = page.getByTestId('panel-characters').getByRole('img', { name: 'Elena Vasquez' }).first()
  await expect(portrait).toHaveAttribute('src', /\/media\/projects\/.+\/character_image\/1-v1\.svg$/)

  expect(errors).toEqual([])
})

test('full stack workspace: settings defaults → projects (open, rename, delete) → assets (regenerate)', async ({ page, request }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await preparePage(page)
  const email = 'apple-user@dev.local'
  const auth = { Authorization: `Bearer dev:${email}` }

  await page.goto('/login')
  await page.getByRole('button', { name: 'Continue with Apple' }).click()
  await page.getByRole('button', { name: 'Skip', exact: true }).click()

  // Every stage is open; with no film yet, panels explain how to start
  await page.getByTestId('nav-storyboard').click()
  await expect(page.getByTestId('panel-empty')).toContainText('No film open yet')

  // Settings → saved to the backend user profile
  await page.getByTestId('nav-settings').click()
  await expect(page.getByTestId('account-email')).toHaveText(email)
  await expect(page.getByTestId('provider-list')).toContainText('Mock')
  await page.getByLabel('Story & voice language').selectOption('ta')
  await page.getByRole('button', { name: /9:16/ }).click()
  await page.getByRole('button', { name: 'Save settings' }).click()
  await expect(page.getByText('Saved. New films use these defaults.')).toBeVisible()
  const me = await (await request.get(`${API}/api/v1/me`, { headers: auth })).json()
  expect(me.preferences).toMatchObject({ language: 'ta', aspectRatio: '9:16' })

  // A new film uses those defaults in its brief
  await page.getByTestId('nav-chat').click()
  await page.getByLabel('Message the AI Director').fill('A temple dancer in Madurai')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('panel-story')).toBeVisible({ timeout: 20_000 })
  const [summary] = await (await request.get(`${API}/api/v1/projects`, { headers: auth })).json()
  const project = await (await request.get(`${API}/api/v1/projects/${summary.id}`, { headers: auth })).json()
  expect(project.brief).toMatchObject({ language: 'ta', aspectRatio: '9:16', prompt: 'A temple dancer in Madurai' })

  // Generate assets through the API so the library has content
  const gen = await (await request.post(`${API}/api/v1/projects/${summary.id}/generate`, { headers: auth, data: {} })).json()
  await expect.poll(async () => (await (await request.get(`${API}/api/v1/jobs/${gen.id}`, { headers: auth })).json()).status).toBe('completed')

  // Projects: thumbnail, rename, open
  await page.getByTestId('nav-projects').click()
  const card = page.getByTestId('project-card')
  await expect(card).toHaveCount(1)
  await expect(card.locator('img')).toHaveAttribute('src', /storyboard_image\/1-v1\.svg$/)
  await expect(card).toContainText('9 assets')
  await card.getByRole('button', { name: 'Rename' }).click()
  await page.getByLabel('Project title').fill('Madurai Nights')
  await page.keyboard.press('Enter')
  await expect(card.getByRole('heading', { name: 'Madurai Nights' })).toBeVisible()
  await card.getByRole('button', { name: 'Open', exact: true }).click()
  // The whole film on one page, read from the backend
  await expect(page).toHaveURL(/\/projects\/[^/]+$/)
  await expect(page.getByTestId('overview-title')).toHaveText('Madurai Nights')
  await expect(page.getByTestId('overview-character')).toHaveCount(3)
  await expect(page.getByTestId('overview-shot')).toHaveCount(4)
  await expect(page.getByTestId('overview-shot').first().locator('img')).toHaveAttribute('src', /storyboard_image\/1-v1\.svg$/)
  await page.getByRole('button', { name: 'Edit Story in the Director' }).click()
  await expect(page.getByTestId('panel-story')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Madurai Nights' })).toBeVisible()

  // Assets: filter, regenerate a portrait → dependent frames become outdated
  await page.getByTestId('nav-assets').click()
  await expect(page.getByTestId('asset-card')).toHaveCount(9)
  await page.getByRole('tab', { name: 'Portraits' }).click()
  await expect(page.getByTestId('asset-card')).toHaveCount(3)
  const elena = page.getByTestId('asset-card').filter({ hasText: 'Elena Vasquez' })
  await elena.getByRole('button', { name: 'Regenerate' }).click()
  await expect(elena).toContainText('v2', { timeout: 15_000 })
  await page.getByRole('tab', { name: 'Storyboard' }).click()
  await expect(page.getByText('Outdated', { exact: true })).toHaveCount(2)
  await expect(page.getByTestId('asset-count')).toHaveText('2 ready · 2 outdated')

  // Delete the project
  await page.getByTestId('nav-projects').click()
  await page.getByRole('button', { name: 'Delete Madurai Nights' }).click()
  await page.getByRole('button', { name: 'Confirm delete' }).click()
  await expect(page.getByText('No films yet')).toBeVisible()
  expect(await (await request.get(`${API}/api/v1/projects`, { headers: auth })).json()).toEqual([])
  expect(errors).toEqual([])
})

test('full stack: attach a story file → backend extracts it → plan uses it', async ({ page, request }) => {
  await preparePage(page)
  const email = 'files-user@dev.local'
  const auth = { Authorization: `Bearer dev:${email}` }
  await page.addInitScript(e => localStorage.setItem('cineai.token', `dev:${e}`), email)
  await page.goto('/director')

  // Paperclip opens the native picker; choose a text file, send it with no message
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Attach files' }).click()
  await (await chooser).setFiles({ name: 'treatment.txt', mimeType: 'text/plain', buffer: Buffer.from('A lighthouse keeper in Kerala finds a radio that receives tomorrow\'s news.') })
  await expect(page.getByTestId('attachment-chips')).toContainText('treatment.txt')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByTestId('panel-story')).toBeVisible({ timeout: 20_000 })

  const projects = await (await request.get(`${API}/api/v1/projects`, { headers: auth })).json()
  expect(projects).toHaveLength(1)
  const docs = await (await request.get(`${API}/api/v1/projects/${projects[0].id}/documents`, { headers: auth })).json()
  expect(docs).toHaveLength(1)
  expect(docs[0].filename).toBe('treatment.txt')
  expect(docs[0].preview).toContain('lighthouse keeper in Kerala')

  // Back in the chat, the message shows the attachment; the mic is ready (browser speech — server STT is mock)
  await page.getByTestId('nav-chat').click()
  await expect(page.getByTestId('panel-chat')).toContainText('treatment.txt')
  await expect(page.getByTestId('mic-button')).toBeEnabled()

  // The project page lists the source file alongside the film
  await page.goto(`/projects/${projects[0].id}`)
  await expect(page.getByTestId('overview-files')).toContainText('treatment.txt')
  await expect(page.getByTestId('overview-files')).toContainText('lighthouse keeper in Kerala')
})

test('full stack: New Film keeps the first film saved and creates a second project', async ({ page, request }) => {
  await preparePage(page)
  const email = 'newfilm-user@dev.local'
  const auth = { Authorization: `Bearer dev:${email}` }
  await page.addInitScript(e => localStorage.setItem('cineai.token', `dev:${e}`), email)
  await page.goto('/director')
  await page.getByLabel('Message the AI Director').fill('A lighthouse keeper hears tomorrow on the radio')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('panel-story')).toBeVisible({ timeout: 20_000 })

  await page.getByRole('button', { name: 'New Film' }).click()
  await expect(page.getByTestId('new-film-note')).toContainText('stays saved in Projects')
  await page.getByRole('button', { name: /Comedy/ }).click()
  await page.getByRole('button', { name: 'Start Comedy film' }).click()
  await expect(page.getByTestId('panel-chat')).toContainText("Let's make a new Comedy film")
  await page.getByLabel('Message the AI Director').fill('Two rival chai stalls on the same street')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('panel-story')).toBeVisible({ timeout: 20_000 })

  const projects = await (await request.get(`${API}/api/v1/projects`, { headers: auth })).json()
  expect(projects).toHaveLength(2)
  expect(projects.map((p: { genre: string }) => p.genre)).toContain('Comedy')
})
