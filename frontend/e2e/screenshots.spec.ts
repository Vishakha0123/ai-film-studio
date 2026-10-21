/**
 * Captures every screen of the app for visual review against the Figma Make design.
 *
 *   npm run screenshots                         # implementation only
 *   FIGMA_REF_URL=http://localhost:5174 npm run screenshots
 *                                               # also captures the Figma Make reference build
 *
 * Output: ../docs/figma-comparison/raw/{impl,figma}-{desktop,mobile}-<frame>.png
 */
import { test, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { preparePage, signIn, runDirector } from './helpers'

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/figma-comparison/raw')
const REF = process.env.FIGMA_REF_URL

const PANELS = ['story', 'characters', 'screenplay', 'dialogue', 'lyrics', 'scenes', 'storyboard', 'audio', 'music'] as const

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
}

async function snap(page: Page, name: string) {
  fs.mkdirSync(OUT, { recursive: true })
  await page.waitForTimeout(900) // let fade-up animations settle
  await page.screenshot({ path: path.join(OUT, `${name}.png`) })
}

for (const [vp, size] of Object.entries(VIEWPORTS)) {
  test.describe(`${vp}`, () => {
    test.use({ viewport: size, isMobile: vp === 'mobile', hasTouch: vp === 'mobile', deviceScaleFactor: vp === 'mobile' ? 2 : 1 })

    test(`implementation (${vp})`, async ({ page }) => {
      test.setTimeout(180_000)
      await preparePage(page)
      await page.goto('/')
      await snap(page, `impl-${vp}-01-landing`)
      await page.goto('/login')
      await snap(page, `impl-${vp}-02-login`)
      await signIn(page)
      await snap(page, `impl-${vp}-03-onboarding`)
      await page.goto('/director')
      await snap(page, `impl-${vp}-04-director-chat`)

      const openMenu = vp === 'mobile' ? async () => { await page.getByTestId('menu-button').click() } : undefined
      await runDirector(page, { openMenu })
      for (const [i, p] of PANELS.entries()) {
        if (openMenu) await openMenu()
        await page.getByTestId(`nav-${p}`).click()
        await snap(page, `impl-${vp}-${String(5 + i).padStart(2, '0')}-panel-${p}`)
      }
      if (openMenu) { await openMenu(); await snap(page, `impl-${vp}-14-sidebar-open`); await page.getByTestId('sidebar-backdrop').click({ position: { x: 360, y: 400 } }) }

      await page.goto('/generation')
      await page.waitForTimeout(1600)
      await snap(page, `impl-${vp}-15-generation`)
      await page.goto('/teaser')
      await snap(page, `impl-${vp}-16-teaser`)
      await page.goto('/export')
      await snap(page, `impl-${vp}-17-export`)
    })

    test(`figma reference (${vp})`, async ({ page }) => {
      test.skip(!REF, 'FIGMA_REF_URL not set')
      test.setTimeout(180_000)
      await preparePage(page)
      const go = async (q: string) => page.goto(`${REF}/?${q}`)
      await go('screen=landing'); await snap(page, `figma-${vp}-01-landing`)
      await go('screen=login'); await snap(page, `figma-${vp}-02-login`)
      await go('screen=onboarding'); await snap(page, `figma-${vp}-03-onboarding`)
      await go('screen=director'); await snap(page, `figma-${vp}-04-director-chat`)
      for (const [i, p] of PANELS.entries()) {
        await go(`screen=director&panel=${p}&progress=8`)
        await snap(page, `figma-${vp}-${String(5 + i).padStart(2, '0')}-panel-${p}`)
      }
      await go('screen=generation'); await page.waitForTimeout(1600); await snap(page, `figma-${vp}-15-generation`)
      await go('screen=teaser'); await snap(page, `figma-${vp}-16-teaser`)
      await go('screen=export'); await snap(page, `figma-${vp}-17-export`)
    })
  })
}
