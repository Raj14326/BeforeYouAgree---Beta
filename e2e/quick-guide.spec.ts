import { expect, test } from '@playwright/test'
import { openApp } from './acceptance-helpers'

test('guide closes without losing work and supports keyboard navigation', async ({ page }) => {
  await openApp(page)
  await page.getByLabel('Service', { exact: true }).fill('Spotify')
  const trigger = page.getByRole('button', { name: '3-step Guide' })
  const guide = page.getByRole('dialog', { name: 'From search to clarity' })
  await trigger.click()
  await expect(guide).toBeVisible()
  await expect(guide.getByRole('listitem')).toHaveCount(3)
  await expect(guide.getByRole('button', { name: 'Close guide' })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(guide.getByRole('button', { name: 'Got it' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(guide.getByRole('button', { name: 'Close guide' })).toBeFocused()
  await guide.getByRole('heading', { name: 'Retrieve a document' }).click()
  await expect(guide).toBeVisible()
  await page.mouse.click(5, 5)
  await expect(guide).not.toBeVisible()
  await expect(trigger).toBeFocused()
  await expect(page.getByLabel('Service', { exact: true })).toHaveValue('Spotify')
  await trigger.click()
  await page.keyboard.press('Escape')
  await expect(guide).not.toBeVisible()
  await expect(trigger).toBeFocused()
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
})

test('guide fits a small screen in both themes and blurs the backdrop', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await openApp(page)
  for (const theme of ['light', 'dark']) {
    await page.evaluate(
      (value) => document.documentElement.setAttribute('data-bs-theme', value),
      theme,
    )
    await page.getByRole('button', { name: 'Guide', exact: true }).click()
    const guide = page.getByRole('dialog')
    await expect(guide).toBeVisible()
    const bounds = await guide.boundingBox()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.y).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(375)
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(667)
    expect(await guide.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
    expect(
      await guide.evaluate((element) => getComputedStyle(element, '::backdrop').backdropFilter),
    ).toBe('blur(6px)')
    await guide.getByRole('button', { name: 'Got it' }).click()
    await expect(guide).not.toBeVisible()
  }
})
