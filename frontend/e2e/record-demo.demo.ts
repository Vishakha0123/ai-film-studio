/**
 * Records the "Watch Demo" video: one take through the real app, with a marker at each chapter.
 * Run with `npm run demo:record` (it also cuts and encodes the video). The story text comes from the built-in
 * sample film (the offline story writer). The two-family part uses a short scene whose Punjabi and Tamil lines
 * are set through the API, because the offline writer can't write those languages.
 */
import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { preparePage } from './helpers'

const API = 'http://localhost:8011'
const AUTH = { Authorization: 'Bearer dev:google-user@dev.local' }
const OUT = process.env.DEMO_MARKERS ?? '.demo-results/markers.json'

const pause = (page: Page, ms: number) => page.waitForTimeout(ms)

async function familyFilm(request: APIRequestContext, id: string) {
  const people = [
    { name: 'Harpreet Malhotra', age: '52', gender: 'female', role: "Rohan's mother — loud, warm, loves a big celebration", family: 'Malhotra family', language: 'pa' },
    { name: 'Kulwant Malhotra', age: '55', gender: 'male', role: "Rohan's father — proud Delhi businessman", family: 'Malhotra family', language: 'pa' },
    { name: 'Rohan Malhotra', age: '27', gender: 'male', role: 'Engineer in love with Ananya', family: 'Malhotra family', language: 'en' },
    { name: 'Krishnan Iyer', age: '58', gender: 'male', role: "Ananya's father — quiet, deeply traditional", family: 'Iyer family', language: 'ta' },
    { name: 'Lakshmi Iyer', age: '54', gender: 'female', role: "Ananya's mother — keeper of the family's rituals", family: 'Iyer family', language: 'ta' },
    { name: 'Ananya Iyer', age: '26', gender: 'female', role: 'Doctor in love with Rohan', family: 'Iyer family', language: 'en' },
  ]
  const film = await (await request.get(`${API}/api/v1/projects/${id}`, { headers: AUTH })).json()
  const existing: { id: string }[] = film.memory.characters
  for (const [i, c] of people.entries()) {
    if (existing[i]) await request.patch(`${API}/api/v1/projects/${id}/characters/${existing[i].id}`, { headers: AUTH, data: c })
    else await request.post(`${API}/api/v1/projects/${id}/characters`, { headers: AUTH, data: c })
  }
  await request.patch(`${API}/api/v1/projects/${id}`, { headers: AUTH, data: { title: 'Two Families, One Wedding' } })
  await request.patch(`${API}/api/v1/projects/${id}/memory`, {
    headers: AUTH,
    data: {
      logline: 'A Punjabi family from Delhi and a Tamil family from Chennai clash over their children’s wedding.',
      scenes: [{ id: '1', number: 1, location: 'INT. MALHOTRA HOUSE', time: 'EVENING', characters: ['Harpreet', 'Krishnan'], mood: 'Comic, tense', duration: '3s', description: 'The two families meet for the first time.' }],
      dialogue: [
        { character: 'Harpreet Malhotra', tone: 'Loud, welcoming', scene: 1, language: 'pa', text: 'ਆਓ ਜੀ, ਆਓ! ਦੇਖੋ, ਅਸੀਂ ਕੱਲ੍ਹ ਲਈ ਪੰਜਾਹ ਕਿੱਲੋ ਪਨੀਰ ਟਿੱਕਾ ਮੰਗਵਾਇਆ ਹੈ!', subtitle: 'Come in, come in! Look, we’ve ordered fifty kilos of paneer tikka for tomorrow!' },
        { character: 'Krishnan Iyer', tone: 'Soft, polite', scene: 1, language: 'ta', text: 'ரொம்ப தாராளமா இருக்கு… ஆனா எங்க பெரியவங்களுக்கு எளிமையான தயிர் சாதமே போதும்.', subtitle: 'That’s very generous… but simple curd rice is enough for our elders.' },
        { character: 'Kulwant Malhotra', tone: 'Proud', scene: 1, language: 'pa', text: 'ਵਿਆਹ ਤਾਂ ਧੂਮਧਾਮ ਨਾਲ ਹੀ ਹੋਵੇਗਾ, ਢੋਲ ਵੀ ਵੱਜੇਗਾ!', subtitle: 'The wedding will be grand — the dhol will play!' },
        { character: 'Lakshmi Iyer', tone: 'Firm', scene: 1, language: 'ta', text: 'நாதஸ்வரம் இல்லாம எப்படி கல்யாணம்? அது தான் எங்க பாரம்பரியம்.', subtitle: 'How can there be a wedding without the nadaswaram? That is our tradition.' },
        { character: 'Rohan Malhotra', tone: 'Quiet', scene: 1, text: 'They’re fighting over food and music. We’re talking about our future.' },
        { character: 'Ananya Iyer', tone: 'Hopeful', scene: 1, text: 'Then let’s give them a wedding with both — the dhol and the nadaswaram.' },
      ],
    },
  })
}

test('record the demo', async ({ page, request }) => {
  const t0 = Date.now()
  const marks: Record<string, number> = {}
  const mark = (name: string) => { marks[name] = (Date.now() - t0) / 1000 }
  await preparePage(page)
  await page.route(/images\.unsplash\.com/, route => route.abort())

  // Sign in and pick a genre (cut from the video)
  await page.goto('/login')
  await page.getByRole('button', { name: 'Continue with Google' }).click()
  await page.getByRole('button', { name: /Drama/ }).click()
  await page.getByRole('button', { name: 'Continue with Drama' }).click()
  await expect(page.getByLabel('Message the AI Director')).toBeVisible()
  await pause(page, 400)

  // 1 · Idea
  mark('idea')
  await pause(page, 900)
  await page.getByLabel('Message the AI Director').pressSequentially('A grieving composer hears messages hidden in her late husband’s unfinished symphony', { delay: 38 })
  await pause(page, 500)
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('reply-duration').first()).toBeVisible({ timeout: 30_000 })
  await pause(page, 2600)

  // 2 · Story & cast
  mark('story')
  await page.getByTestId('nav-story').click()
  await pause(page, 2600)
  await page.mouse.wheel(0, 420)
  await pause(page, 2000)
  await page.getByTestId('nav-characters').click()
  await pause(page, 2600)
  await page.getByTestId('panel-characters').getByRole('button').nth(1).click()
  await pause(page, 2200)

  // 3 · Full film
  mark('full')
  const [composer] = await (await request.get(`${API}/api/v1/projects`, { headers: AUTH })).json()
  await page.goto(`/projects/${composer.id}/movie`)
  await page.getByRole('radio', { name: /10 min/ }).click()
  await pause(page, 900)
  await page.getByTestId('movie-plan').click()
  await expect(page.getByTestId('movie-story')).toBeVisible({ timeout: 60_000 })
  await pause(page, 2200)
  await page.getByTestId('movie-write-script').click()
  await expect(page.getByTestId('movie-script-count')).toContainText('7/7', { timeout: 60_000 })
  await pause(page, 800)
  await page.getByTestId('movie-scene-1').scrollIntoViewIfNeeded()
  await page.getByTestId('movie-scene-1').locator('button').first().click()
  await pause(page, 900)
  await page.getByTestId('movie-scene-1').locator('summary').click()
  await pause(page, 2800)

  // 4 · Languages (a second film: two families)
  const res = await request.post(`${API}/api/v1/projects`, { headers: AUTH, data: { genres: ['Drama'] } })
  const fam = await res.json()
  await request.post(`${API}/api/v1/projects/${fam.id}/brief`, { headers: AUTH, data: { prompt: 'A Punjabi family and a Tamil family fight over their children’s wedding' } })
  const job = await (await request.post(`${API}/api/v1/projects/${fam.id}/plan`, { headers: AUTH, data: {} })).json()
  await expect.poll(async () => (await (await request.get(`${API}/api/v1/jobs/${job.id}`, { headers: AUTH })).json()).status).toBe('completed')
  await familyFilm(request, fam.id)
  mark('languages')
  await page.goto(`/projects/${fam.id}`)
  await page.getByRole('button', { name: 'Open in Director' }).click()
  await page.getByTestId('nav-characters').click()
  await expect(page.getByTestId('character-family')).toHaveCount(2)
  await pause(page, 3000)
  await page.getByTestId('nav-dialogue').click()
  await expect(page.getByTestId('dialogue-subtitle').first()).toBeVisible()
  await pause(page, 2000)
  await page.mouse.wheel(0, 380)
  await pause(page, 2600)

  // 5 · Script & PDF (back to the full-length film)
  mark('script')
  await page.goto(`/projects/${composer.id}`)
  await page.getByRole('button', { name: 'Open in Director' }).click()
  await page.getByTestId('nav-screenplay').click()
  await expect(page.getByTestId('full-film-screenplay')).toBeVisible()
  await pause(page, 2000)
  await page.mouse.wheel(0, 700)
  await pause(page, 1800)
  await page.goto(`/projects/${composer.id}/movie`)
  await page.getByTestId('movie-download-script-pdf').scrollIntoViewIfNeeded()
  await pause(page, 900)
  const download = page.waitForEvent('download')
  await page.getByTestId('movie-download-script-pdf').click()
  await download
  await pause(page, 2400)
  mark('end')

  writeFileSync(OUT, JSON.stringify(marks, null, 2))
})
