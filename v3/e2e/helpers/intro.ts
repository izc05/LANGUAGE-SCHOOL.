import { expect, type Page } from '@playwright/test'

export async function enterHome(page: Page) {
  await page.goto('/')
  const enter = page.getByRole('button', { name: 'ENTRAR' })
  const skip = page.getByRole('button', { name: 'Saltar intro' })
  const homeHeader = page.locator('.site-header')
  const cloudPortal = page.locator('.cloud-portal-transition')
  await Promise.race([
    enter.waitFor({ state: 'visible' }),
    skip.waitFor({ state: 'visible' }),
    homeHeader.waitFor({ state: 'visible' }),
  ])
  if (await homeHeader.isVisible()) {
    await expect(cloudPortal).toHaveCount(0, { timeout: 5000 })
    return
  }

  if (await skip.count()) await skip.click()

  await expect(enter).toBeEnabled()
  await enter.dispatchEvent('click')
  await expect(homeHeader).toBeVisible()
  await expect(cloudPortal).toHaveCount(0, { timeout: 5000 })
}
