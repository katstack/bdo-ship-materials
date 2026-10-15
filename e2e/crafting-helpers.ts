import { expect, type Page } from '@playwright/test'

export async function openCraftingNode(page: Page, id: string) {
  const settings = page.locator(`[data-settings-item="${id}"]`)
  await expect(settings).toBeAttached()
  if (!(await settings.evaluate((element) => (element as HTMLDetailsElement).open)))
    await settings.locator(':scope > summary').click()
  return settings.locator(`tr[data-crafting-item-id="${id}"]`)
}

export function supplyRow(page: Page, id: string) {
  return page.locator(`tr[data-supply-item-id="${id}"]`)
}
