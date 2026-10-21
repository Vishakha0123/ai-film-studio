import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PLACEHOLDER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'placeholder-photo.jpg')

/**
 * When OFFLINE_PHOTOS=1 (e.g. CI or sandboxes without internet), serve a neutral
 * placeholder instead of the Unsplash photos so pages still render deterministically.
 */
export async function preparePage(page: Page) {
  if (process.env.OFFLINE_PHOTOS === '1') {
    await page.route(/images\.unsplash\.com/, route => route.fulfill({ path: PLACEHOLDER, contentType: 'image/jpeg' }))
  }
}

export async function signIn(page: Page) {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Continue with Google' }).click()
  await expect(page.getByTestId('screen-onboarding')).toBeVisible()
}

/** Stages the AI Director walks through (Audio and Music are Coming soon). */
export const STAGES = ['story', 'characters', 'screenplay', 'dialogue', 'lyrics', 'scenes', 'storyboard'] as const

/** Drives the AI Director chat through every workflow stage. */
export async function runDirector(page: Page, opts: { openMenu?: () => Promise<void> } = {}) {
  for (const stage of STAGES) {
    if (!(await page.getByTestId('panel-chat').isVisible().catch(() => false))) {
      if (opts.openMenu) await opts.openMenu()
      await page.getByTestId('nav-chat').click()
    }
    await page.getByLabel('Message the AI Director').fill(stage === 'story' ? 'A grieving composer hears messages in her late husband\'s symphony' : `Looks great — continue to ${stage}`)
    await page.keyboard.press('Enter')
    await expect(page.getByTestId(`panel-${stage}`)).toBeVisible({ timeout: 8000 })
  }
}
