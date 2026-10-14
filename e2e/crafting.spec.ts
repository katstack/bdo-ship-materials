import { test, expect } from '@playwright/test'

test('search, unnamed items, recipes, tree expansion, cached reload and mobile', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('./#/crafting')
  const search = page.getByRole('textbox', { name: '제작노트 아이템 검색' })
  await expect(page.locator('.crafting-results button').first()).toBeVisible()
  await search.fill('16263')
  await page.locator('.crafting-results button').first().click()
  await expect(page.locator('.crafting-detail h2')).toHaveText('아이템 16263')
  await search.fill('규격 각목')
  await page.getByRole('button', { name: '규격 각목 4685 · Wood', exact: true }).click()
  await expect(page.locator('.crafting-detail h2')).toHaveText('규격 각목')
  await expect(page.locator('.crafting-recipe').first()).toBeVisible()
  await page
    .locator('.crafting-ingredient')
    .first()
    .getByRole('button', { name: '+', exact: true })
    .click()
  await expect(page.locator('.crafting-branch').first()).toBeVisible()
  await page.reload()
  await expect(page.locator('.crafting-detail h2')).toHaveText('규격 각목')
  await search.fill('없는재료abcdef')
  await expect(page.locator('.crafting-results button')).toHaveCount(0)
  await page.setViewportSize({ width: 390, height: 844 })
  await search.fill('각목')
  await expect(page.locator('.crafting-results button').first()).toBeVisible()
  expect(errors).toEqual([])
})
