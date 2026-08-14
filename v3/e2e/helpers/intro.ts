import { expect, type Page } from '@playwright/test'

export async function enterHome(page: Page) {
  await page.goto('/')
  const enter = page.getByRole('button', { name: 'ENTRAR' })
  const homeHeader = page.locator('.site-header')
  await Promise.race([
    enter.waitFor({ state: 'visible' }),
    homeHeader.waitFor({ state: 'visible' }),
  ])
  if (await homeHeader.isVisible()) return

  const skip = page.getByRole('button', { name: 'Saltar intro' })
  if (await skip.count()) await skip.click()

  await expect(enter).toBeEnabled()
  await enter.dispatchEvent('click')
  await expect(homeHeader).toBeVisible()
}
