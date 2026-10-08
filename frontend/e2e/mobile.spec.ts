import { test, expect } from '@playwright/test'
import { preparePage, signIn, runDirector } from './helpers'

test.beforeEach(async ({ page }) => preparePage(page))

test('mobile: no horizontal overflow on public screens', async ({ page }) => {
  for (const path of ['/', '/login']) {
    await page.goto(path)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, path).toBeLessThanOrEqual(0)
  }
})

test('mobile: sidebar is a drawer and the director flow works', async ({ page }) => {
  await signIn(page)
  await page.getByRole('button', { name: 'Skip', exact: true }).click()

  const sidebar = page.getByTestId('sidebar')
  await expect(sidebar).toHaveAttribute('data-open', 'false')
  await expect(page.getByTestId('menu-button')).toBeVisible()

  const openMenu = async () => {
    await page.getByTestId('menu-button').click()
    await expect(sidebar).toHaveAttribute('data-open', 'true')
  }
  await runDirector(page, { openMenu })

  await openMenu()
  await page.getByTestId('nav-characters').click()
  await expect(sidebar).toHaveAttribute('data-open', 'false')
  await expect(page.getByTestId('panel-characters')).toBeVisible()

  for (const path of ['/director', '/director/storyboard', '/new', '/projects', '/projects/demo', '/assets', '/settings']) {
    await page.goto(path)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, path).toBeLessThanOrEqual(0)
  }
})
