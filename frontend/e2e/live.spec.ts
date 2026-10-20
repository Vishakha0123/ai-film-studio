import { test, expect } from '@playwright/test'
import { preparePage } from './helpers'
import { readFileSync } from 'node:fs'

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

test('full stack: Continue buttons walk the planned film and approve each step', async ({ page, request }) => {
  await preparePage(page)
  const email = 'continue-user@dev.local'
  const auth = { Authorization: `Bearer dev:${email}` }
  await page.addInitScript(e => localStorage.setItem('cineai.token', `dev:${e}`), email)
  await page.goto('/director')
  await page.getByLabel('Message the AI Director').fill('A dabbawala delivers a lunchbox to the wrong decade')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('panel-story')).toBeVisible({ timeout: 20_000 })
  // This build has the Coming-soon sections unlocked, so Audio follows the storyboard here
  for (const next of ['characters', 'screenplay', 'dialogue', 'lyrics', 'scenes', 'storyboard', 'audio']) {
    await page.getByTestId('continue-button').click()
    await expect(page.getByTestId(`panel-${next}`)).toBeVisible()
  }
  await expect(page.getByTestId('continue-button')).toHaveText(/Finish/)
  await page.getByTestId('continue-button').click()
  await expect(page.getByTestId('panel-chat')).toContainText('Everything is in place')

  const [p] = await (await request.get(`${API}/api/v1/projects`, { headers: auth })).json()
  const full = await (await request.get(`${API}/api/v1/projects/${p.id}`, { headers: auth })).json()
  expect(full.memory.title).toBeTruthy()
})

test('full stack: film language — English prompt, Tamil film, then Hindi and Telugu versions without retyping', async ({ page, request }) => {
  await preparePage(page)
  const email = 'language-user@dev.local'
  const auth = { Authorization: `Bearer dev:${email}` }
  await page.addInitScript(e => localStorage.setItem('cineai.token', `dev:${e}`), email)
  await page.goto('/director')

  // Prompt written in English, film chosen in Tamil
  await page.getByLabel('Film language').selectOption('ta')
  await page.getByLabel('Message the AI Director').fill('A fisherman finds a radio that plays tomorrow')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('panel-story')).toBeVisible({ timeout: 20_000 })
  let projects = await (await request.get(`${API}/api/v1/projects`, { headers: auth })).json()
  expect(projects).toHaveLength(1)
  const original = await (await request.get(`${API}/api/v1/projects/${projects[0].id}`, { headers: auth })).json()
  expect(original.language).toBe('ta')
  expect(original.brief.prompt).toBe('A fisherman finds a radio that plays tomorrow')

  // Same film in Hindi from the chat — nothing retyped
  await page.getByTestId('nav-chat').click()
  await expect(page.getByLabel('Film language')).toHaveValue('ta')
  await page.getByLabel('Film language').selectOption('hi')
  await expect(page.getByTestId('panel-chat')).toContainText('Make this film in Hindi')
  await expect(page.getByTestId('panel-chat')).toContainText('in Hindi — the same story, cast and storyboard', { timeout: 20_000 })
  await expect(page.getByLabel('Film language')).toHaveValue('hi')
  projects = await (await request.get(`${API}/api/v1/projects`, { headers: auth })).json()
  expect(projects).toHaveLength(2)
  const hindi = projects.find((p: { language: string }) => p.language === 'hi')
  const hindiFull = await (await request.get(`${API}/api/v1/projects/${hindi.id}`, { headers: auth })).json()
  expect(hindiFull.brief.prompt).toBe(original.brief.prompt)
  expect(hindiFull.title).toContain('हिन्दी')

  // And Telugu from the project page
  await page.goto(`/projects/${original.id}`)
  await expect(page.getByTestId('overview-language')).toContainText('Tamil')
  await page.getByLabel('Make this film in another language').selectOption('te')
  await expect(page).not.toHaveURL(new RegExp(original.id), { timeout: 20_000 })
  await expect(page.getByTestId('overview-language')).toContainText('Telugu')
  await expect(page.getByTestId('overview-title')).toContainText('తెలుగు')
})

test('full stack: the theme song comes from the film and can be rewritten by the AI', async ({ page, request }) => {
  await preparePage(page)
  const email = 'lyrics-user@dev.local'
  const auth = { Authorization: `Bearer dev:${email}` }
  await page.addInitScript(e => localStorage.setItem('cineai.token', `dev:${e}`), email)
  await page.goto('/director')
  await page.getByLabel('Film language').selectOption('gu')
  await page.getByLabel('Message the AI Director').fill('A girl who can hear trees speak')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('panel-story')).toBeVisible({ timeout: 20_000 })

  const [p] = await (await request.get(`${API}/api/v1/projects`, { headers: auth })).json()
  const film = await (await request.get(`${API}/api/v1/projects/${p.id}`, { headers: auth })).json()
  expect(film.memory.lyrics.chorus).toBeTruthy()

  await page.getByTestId('nav-lyrics').click()
  await expect(page.getByTestId('song-title')).toHaveText(film.memory.lyrics.title)
  await expect(page.getByLabel('Verse lyrics')).toHaveValue(film.memory.lyrics.verse)
  await page.getByRole('button', { name: 'Improve Rhyme' }).click()
  await expect(page.getByLabel('Verse lyrics')).toHaveValue(/\[Revised: Improve the rhyme/, { timeout: 15_000 })

  // the project page shows the song too
  await page.goto(`/projects/${p.id}`)
  await expect(page.getByTestId('overview-lyrics')).toContainText(film.memory.lyrics.title)
})

test('full stack: select several projects and delete them together', async ({ page, request }) => {
  await preparePage(page)
  const email = 'bulk-user@dev.local'
  const auth = { Authorization: `Bearer dev:${email}` }
  const ids: string[] = []
  for (const title of ['Film A', 'Film B', 'Film C', 'Film D']) {
    ids.push((await (await request.post(`${API}/api/v1/projects`, { headers: auth, data: { title } })).json()).id)
  }
  await page.addInitScript(e => localStorage.setItem('cineai.token', `dev:${e}`), email)
  await page.goto('/projects')
  await expect(page.getByTestId('project-card')).toHaveCount(4)

  // Select two, Esc cancels, select again, delete
  await page.getByTestId('select-mode').click()
  await page.getByTestId('project-card').filter({ hasText: 'Film A' }).click()
  await page.getByTestId('project-card').filter({ hasText: 'Film C' }).click()
  await expect(page.getByTestId('selected-count')).toHaveText('2 selected')
  await expect(page).toHaveURL(/\/projects$/) // clicking a card selects it instead of opening it
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('bulk-bar')).toBeHidden()
  await page.getByTestId('select-mode').click()
  await page.getByRole('button', { name: 'Select Film A' }).click()
  await page.getByRole('button', { name: 'Select Film C' }).click()
  await page.getByRole('button', { name: 'Delete 2' }).click()
  await page.getByRole('button', { name: 'Yes, delete' }).click()
  await expect(page.getByTestId('bulk-notice')).toHaveText('Deleted 2 films.')
  await expect(page.getByTestId('project-card')).toHaveCount(2)
  const left = (await (await request.get(`${API}/api/v1/projects`, { headers: auth })).json()).map((p: { title: string }) => p.title).sort()
  expect(left).toEqual(['Film B', 'Film D'])

  // Select all → Keep cancels → delete for real
  await page.getByTestId('select-mode').click()
  await page.getByRole('button', { name: 'Select all (2)' }).click()
  await page.getByRole('button', { name: 'Delete 2' }).click()
  await page.getByRole('button', { name: 'Keep' }).click()
  await expect(page.getByTestId('project-card')).toHaveCount(2)
  await page.getByRole('button', { name: 'Delete 2' }).click()
  await page.getByRole('button', { name: 'Yes, delete' }).click()
  await expect(page.getByText('No films yet')).toBeVisible()
  expect(await (await request.get(`${API}/api/v1/projects`, { headers: auth })).json()).toHaveLength(0)
})

test('full stack: add, edit, change appearance, regenerate and remove characters', async ({ page, request }) => {
  await preparePage(page)
  const email = 'cast-user@dev.local'
  const auth = { Authorization: `Bearer dev:${email}` }
  await page.addInitScript(e => localStorage.setItem('cineai.token', `dev:${e}`), email)
  await page.goto('/director')
  await page.getByLabel('Message the AI Director').fill('A detective and a clockwork elephant')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('panel-story')).toBeVisible({ timeout: 20_000 })
  await page.getByTestId('nav-characters').click()
  const panel = page.getByTestId('panel-characters')
  const [proj] = await (await request.get(`${API}/api/v1/projects`, { headers: auth })).json()
  const start = (await (await request.get(`${API}/api/v1/projects/${proj.id}`, { headers: auth })).json()).memory.characters.length
  await expect(panel.getByText(`${start} characters`)).toBeVisible()

  // Add by hand
  await panel.getByRole('button', { name: /Add Character/ }).click()
  await page.getByPlaceholder('e.g. Sundar').fill('Sundar')
  await page.getByPlaceholder('e.g. Temple tea boy and key-bearer').fill('Tea boy')
  await page.getByRole('button', { name: 'Add character', exact: true }).click()
  await expect(panel.getByText(`${start + 1} characters`)).toBeVisible()
  await expect(panel.getByRole('button', { name: /Sundar Tea boy/ })).toHaveAttribute('aria-pressed', 'true')

  // Edit the new character
  await panel.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByPlaceholder('Who are they? What do they want?').fill('Fixes watches, fears nothing')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(panel.getByText('Fixes watches, fears nothing')).toBeVisible()

  // Change appearance
  await panel.getByRole('button', { name: 'Change Appearance' }).click()
  await page.getByPlaceholder(/What do they look like/).fill('Barefoot, oversized khaki shirt, brass key on a string')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(panel.getByText('Barefoot, oversized khaki shirt')).toBeVisible()

  // Regenerate (AI) this character
  await panel.getByRole('button', { name: 'Regenerate' }).click()
  await expect(panel.getByText(/\[Revised:/)).toBeVisible({ timeout: 15_000 })

  // Let the AI write a character
  await panel.getByRole('button', { name: /Add Character/ }).click()
  await page.getByPlaceholder('e.g. Sundar').fill('Gajaraj')
  await page.getByRole('button', { name: '✨ Let AI write it' }).click()
  await expect(panel.getByText(`${start + 2} characters`)).toBeVisible({ timeout: 15_000 })

  // Remove Sundar
  await panel.getByRole('button', { name: /Sundar Tea boy/ }).click()
  await panel.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByRole('button', { name: 'Remove Sundar' }).click()
  await page.getByRole('button', { name: 'Yes, remove' }).click()
  await expect(panel.getByText(`${start + 1} characters`)).toBeVisible()

  const [p] = await (await request.get(`${API}/api/v1/projects`, { headers: auth })).json()
  const names = (await (await request.get(`${API}/api/v1/projects/${p.id}`, { headers: auth })).json()).memory.characters.map((c: { name: string }) => c.name)
  expect(names).not.toContain('Sundar')
  expect(names.length).toBe(start + 1)
})

test('full stack: screenplay, dialogue and storyboard buttons all work', async ({ page, request }) => {
  test.setTimeout(150_000)
  await preparePage(page)
  const email = 'actions-user@dev.local'
  const auth = { Authorization: `Bearer dev:${email}` }
  await page.addInitScript(e => localStorage.setItem('cineai.token', `dev:${e}`), email)
  await page.goto('/director')
  await page.getByLabel('Message the AI Director').fill('A teacher meets her double in a Himalayan school')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('panel-story')).toBeVisible({ timeout: 20_000 })
  const memory = async () => {
    const [p] = await (await request.get(`${API}/api/v1/projects`, { headers: auth })).json()
    return (await (await request.get(`${API}/api/v1/projects/${p.id}`, { headers: auth })).json()).memory
  }

  // Screenplay: an action and the Continue button change the script
  await page.getByTestId('nav-screenplay').click()
  const sp = page.getByTestId('panel-screenplay')
  await sp.getByRole('button', { name: 'Make Cinematic' }).click()
  await expect(sp.getByText(/\[Revised: .*more cinematic/)).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('screenplay-draft')).toHaveText('Draft 2')
  await sp.getByRole('button', { name: /Continue Screenplay/ }).click()
  await expect(page.getByTestId('screenplay-draft')).toHaveText('Draft 3', { timeout: 15_000 })
  // Selecting text scopes the next action to it
  await sp.locator('[data-kind="heading"]').first().selectText()
  await expect(page.getByTestId('screenplay-selection')).toBeVisible()
  await sp.getByRole('button', { name: 'Shorten' }).click()
  await expect(page.getByTestId('screenplay-draft')).toHaveText('Draft 4', { timeout: 15_000 })
  await expect(page.getByTestId('screenplay-selection')).toBeHidden()

  // Dialogue: Generate More, Apply to one line, Edit, Use This
  await page.getByTestId('nav-dialogue').click()
  const dl = page.getByTestId('panel-dialogue')
  const before = (await memory()).dialogue.length
  await dl.getByRole('button', { name: 'Generate More' }).first().click()
  await expect(dl.locator('[data-testid^="dialogue-"]')).toHaveCount(before + 1, { timeout: 15_000 })
  await page.getByTestId('dialogue-1').click()
  await dl.getByRole('button', { name: 'Make it scarier' }).click()
  await dl.getByRole('button', { name: 'Apply' }).click()
  await expect(page.getByTestId('dialogue-1')).toContainText('[Revised: Rewrite this line: Make it scarier', { timeout: 15_000 })
  await page.getByTestId('dialogue-2').click()
  await page.getByTestId('dialogue-2').getByRole('button', { name: 'Edit' }).click()
  await page.getByLabel('Line').fill('Who is standing behind me?')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByTestId('dialogue-2')).toContainText('Who is standing behind me?')
  await page.getByTestId('dialogue-2').getByRole('button', { name: 'Use This' }).click() // still selected after saving
  await expect(page.getByTestId('dialogue-2')).toContainText('Used ✓', { timeout: 15_000 })
  expect((await memory()).dialogue[1].text).toBe('Who is standing behind me?')

  // Storyboard: style saved, camera changed, shot regenerated
  await page.getByTestId('nav-storyboard').click()
  const sb = page.getByTestId('panel-storyboard')
  await sb.getByRole('button', { name: 'Anime' }).click()
  await expect.poll(async () => (await memory()).visualStyle, { timeout: 10_000 }).toBe('Anime')
  await expect(sb.getByTestId('shot-image').first()).toHaveCSS('filter', /saturate\(1\.9\)/)
  await page.getByTestId('shot-1').click()
  await page.getByTestId('shot-1').getByRole('button', { name: 'Change Camera' }).click()
  await page.getByLabel('Camera').selectOption('Aerial')
  await page.getByLabel('Movement').selectOption('Crane up')
  await page.getByTestId('shot-1').getByRole('button', { name: 'Save' }).click()
  await expect(page.getByTestId('shot-1')).toContainText('Aerial')
  await page.getByTestId('shot-2').click()
  await page.getByTestId('shot-2').getByRole('button', { name: 'Regenerate' }).click()
  await expect(page.getByTestId('shot-2')).toContainText('[Revised:', { timeout: 15_000 })
  const m = await memory()
  expect(m.shots[0].camera).toBe('Aerial')
  expect(m.shots[0].movement).toBe('Crane up')
})

test('full stack: dialogue per scene — "give me the second scene dialogue" adds scene 2 lines and keeps scene 1', async ({ page, request }) => {
  await preparePage(page)
  const email = 'scenes-user@dev.local'
  const auth = { Authorization: `Bearer dev:${email}` }
  await page.addInitScript(e => localStorage.setItem('cineai.token', `dev:${e}`), email)
  await page.goto('/director')
  await page.getByLabel('Message the AI Director').fill('A city girl and a meddling ghost run a Himalayan homestay')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('panel-story')).toBeVisible({ timeout: 20_000 })
  await page.getByTestId('nav-dialogue').click()
  const tabs = page.getByTestId('scene-tabs')
  await expect(tabs.getByRole('tab')).not.toHaveCount(0)
  // Write lines for scene 3 from its own tab
  await tabs.getByRole('tab', { name: /Scene 3/ }).click()
  await page.getByTestId('panel-dialogue').getByRole('button', { name: 'Generate More' }).first().click()
  await expect(tabs.getByRole('tab', { name: /Scene 3 · 1 line/ })).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('[data-scene="3"]')).toHaveCount(1)
  const [p] = await (await request.get(`${API}/api/v1/projects`, { headers: auth })).json()
  const d = (await (await request.get(`${API}/api/v1/projects/${p.id}`, { headers: auth })).json()).memory.dialogue
  expect(d.filter((l: { scene?: number }) => l.scene === 3)).toHaveLength(1)
  expect(d.length).toBeGreaterThan(1) // the other scenes' lines are still there
})

test('full stack: settings — writing & voice defaults shape new films, voice preview, export and delete account', async ({ page, request }) => {
  await preparePage(page)
  const email = 'settings-user@dev.local'
  const auth = { Authorization: `Bearer dev:${email}` }
  await page.addInitScript(e => localStorage.setItem('cineai.token', `dev:${e}`), email)
  await page.goto('/settings')
  await expect(page.getByTestId('account-email')).toHaveText(email)

  // Writing + voice defaults are saved to the account
  await page.getByTestId('style-defaults').getByRole('button', { name: /Anime/ }).click()
  await page.getByTestId('length-defaults').getByRole('button', { name: /Short/ }).click()
  await page.getByRole('combobox', { name: 'Voice', exact: true }).selectOption('kavya')
  await page.getByRole('button', { name: 'Save settings' }).click()
  await expect(page.getByText('Saved. New films use these defaults.')).toBeVisible()
  const me = await (await request.get(`${API}/api/v1/me`, { headers: auth })).json()
  expect(me.preferences).toMatchObject({ visualStyle: 'Anime', filmLength: 'short', voice: 'kavya' })

  // Preview plays audio from the backend (no error shown)
  const preview = page.waitForResponse(r => r.url().endsWith('/voice/preview'))
  await page.getByRole('button', { name: 'Preview voice' }).click()
  const res = await preview
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toBe('audio/wav')
  await expect(page.getByRole('alert')).toHaveCount(0)

  // A new film starts in the chosen look
  await page.getByTestId('nav-chat').click()
  await page.getByLabel('Message the AI Director').fill('Two rival chefs share one food truck in Goa')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('panel-story')).toBeVisible({ timeout: 20_000 })
  const [p] = await (await request.get(`${API}/api/v1/projects`, { headers: auth })).json()
  expect((await (await request.get(`${API}/api/v1/projects/${p.id}`, { headers: auth })).json()).memory.visualStyle).toBe('Anime')

  // Export downloads every film
  await page.getByTestId('nav-settings').click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export all my films' }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe('cinema-ai-export.json')
  const data = JSON.parse(readFileSync(await file.path(), 'utf8'))
  expect(data.films.map((f: { id: string }) => f.id)).toEqual([p.id])

  // Delete account → signed out, films gone
  await page.getByRole('button', { name: 'Delete my account' }).click()
  await page.getByLabel('Type DELETE to confirm').fill('DELETE')
  await page.getByRole('button', { name: 'Delete everything' }).click()
  await expect(page.getByTestId('screen-login')).toBeVisible()
  expect(await (await request.get(`${API}/api/v1/projects`, { headers: auth })).json()).toEqual([])
})

test('full stack: stay signed in on return, and edit every section by hand or with Direct the AI', async ({ page, request }) => {
  await preparePage(page)
  const email = 'apple-user@dev.local'
  const auth = { Authorization: `Bearer dev:${email}` }
  // Sign in once
  await page.goto('/login')
  await page.getByRole('button', { name: 'Continue with Apple' }).click()
  await page.getByRole('button', { name: 'Skip', exact: true }).click()
  // Coming back to the site later skips landing and login
  await page.goto('/')
  await expect(page).toHaveURL(/\/director$/)
  await page.goto('/login')
  await expect(page).toHaveURL(/\/director$/)

  await page.getByLabel('Message the AI Director').fill('A lighthouse keeper adopts a talking seagull')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('panel-story')).toBeVisible({ timeout: 20_000 })
  const [p] = await (await request.get(`${API}/api/v1/projects`, { headers: auth })).json()
  const memory = async () => (await (await request.get(`${API}/api/v1/projects/${p.id}`, { headers: auth })).json()).memory

  // Story by hand
  await page.getByTestId('panel-story').getByRole('button', { name: 'Edit' }).click()
  await page.getByLabel('Logline').fill('A lonely keeper and a loud seagull save the harbour.')
  await page.getByRole('button', { name: 'Save story' }).click()
  await expect(page.getByTestId('story-edit')).toHaveCount(0)
  await expect(page.getByTestId('panel-story')).toContainText('A lonely keeper and a loud seagull save the harbour.')
  expect((await memory()).logline).toBe('A lonely keeper and a loud seagull save the harbour.')

  // Story with Direct the AI
  const storyAI = page.getByTestId('direct-ai-story')
  await storyAI.getByLabel('Direct the AI').fill('Add a twist')
  await storyAI.getByRole('button', { name: 'Apply' }).click()
  await expect(storyAI.getByLabel('Direct the AI')).toHaveValue('', { timeout: 15_000 })
  await expect(storyAI.getByRole('alert')).toHaveCount(0)

  // Screenplay by hand
  await page.getByTestId('nav-screenplay').click()
  await page.getByTestId('panel-screenplay').getByRole('button', { name: 'Edit' }).click()
  const script = page.getByLabel('Screenplay text')
  await script.fill(`${await script.inputValue()}\n\nFADE OUT.`)
  await page.getByRole('button', { name: 'Save screenplay' }).click()
  await expect(page.getByTestId('screenplay-edit')).toHaveCount(0)
  expect((await memory()).screenplay.trim().endsWith('FADE OUT.')).toBe(true)

  // One scene by hand
  await page.getByTestId('nav-scenes').click()
  await page.getByRole('button', { name: 'Edit scene 1' }).click()
  await page.getByLabel('Location').fill('EXT. LIGHTHOUSE ROOF')
  await page.getByRole('button', { name: 'Save scene' }).click()
  await expect(page.getByTestId('scene-edit')).toHaveCount(0)
  await expect(page.getByTestId('scene-card').first()).toContainText('EXT. LIGHTHOUSE ROOF')
  expect((await memory()).scenes[0].location).toBe('EXT. LIGHTHOUSE ROOF')

  // Lyrics typed in place are saved
  await page.getByTestId('nav-lyrics').click()
  const verse = page.getByLabel('Verse lyrics')
  await verse.fill('Gulls above the grey, keeper of the bay')
  await page.getByRole('button', { name: 'Save lyrics' }).click()
  await expect(page.getByTestId('lyrics-unsaved')).toHaveCount(0)
  expect((await memory()).lyrics.verse).toBe('Gulls above the grey, keeper of the bay')

  // A reload keeps you signed in and on your film
  await page.reload()
  await expect(page.getByTestId('panel-lyrics')).toBeVisible()
  await expect(page.getByTestId('screen-login')).toHaveCount(0)
})

test('full stack: a Punjabi film whose screenplay came out in English offers "Rewrite in Punjabi"', async ({ page }) => {
  await preparePage(page)
  await page.addInitScript(() => localStorage.setItem('cineai.token', 'dev:punjabi-user@dev.local'))
  await page.goto('/director')
  await page.getByLabel('Film language').selectOption('pa')
  await page.getByLabel('Message the AI Director').fill('Revenge in the monsoon rain')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('panel-story')).toBeVisible({ timeout: 20_000 })
  // The offline test model writes English (and can't translate), so the banner stays visible
  await page.getByTestId('nav-screenplay').click()
  const banner = page.getByTestId('language-fix-screenplay')
  await expect(banner).toContainText('This screenplay came out in English, but your film is in Punjabi.')
  const edit = page.waitForResponse(r => r.url().includes('/transform') && r.request().method() === 'POST')
  await banner.getByRole('button', { name: 'Rewrite in Punjabi' }).click()
  const body = (await edit).request().postDataJSON()
  expect(body.target).toBe('screenplay')
  expect(body.instruction).toContain('Translate the whole screenplay into Punjabi (ਪੰਜਾਬੀ)')
  await expect(banner.getByRole('button', { name: 'Rewrite in Punjabi' })).toBeEnabled({ timeout: 15_000 })
  await expect(banner.getByRole('alert')).toHaveCount(0)
})
