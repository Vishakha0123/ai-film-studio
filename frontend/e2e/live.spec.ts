import { test, expect } from '@playwright/test'
import { preparePage } from './helpers'

const API = 'http://localhost:8010'

test('full stack: login → plan with AI → generate assets → teaser → render explains missing video', async ({ page, request }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await preparePage(page)

  // Dev login through the backend
  await page.goto('/login')
  await expect(page.getByText('Dev login — any email works')).toBeVisible()
  await page.getByLabel('Email address').fill('director@cinema.ai')
  await page.getByLabel('Password').fill('anything')
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page.getByTestId('screen-onboarding')).toBeVisible()
  await page.getByRole('button', { name: /Horror/ }).click()
  await page.getByRole('button', { name: 'Continue with Horror' }).click()

  // First idea → POST /projects, /brief, /plan → poll /jobs/{id}
  await page.getByLabel('Message the AI Director').fill('A grieving composer hears messages in her late husband\'s symphony')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('panel-story')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('heading', { name: 'Echoes of the Forgotten' })).toBeVisible()

  // The project really exists in the backend, owned by this user
  const auth = { Authorization: 'Bearer dev:director@cinema.ai' }
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
