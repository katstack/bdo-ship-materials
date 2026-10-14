import { test, expect } from '@playwright/test'

test('acquisition methods distinguish vendors, special currency, variable barter and rentals', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('./#/crafting/item/9002')
  const methods = page.locator('.crafting-detail > .acquisition-methods')
  await expect(methods).toContainText('NPC 구매')
  await expect(methods).toContainText('아이템 기본 가격값: 20')
  await methods.locator('.acquisition-vendors summary').click()
  await expect(methods.getByRole('link', { name: 'David Finto', exact: true })).toBeVisible()
  await expect(methods).toContainText('Velia')
  await expect(methods).not.toContainText('까마귀 주화 구매')
  await page.reload()
  await expect(methods).toContainText('아이템 기본 가격값: 20')
  await page.goto('./#/crafting/item/5812')
  await expect(methods).toContainText('1개당 80 까마귀 주화')
  await expect(methods).toContainText('교역품 1개 → 1 또는 2개')
  await expect(methods).not.toContainText('아이템 기본 가격값')
  await page.goto('./#/crafting/item/3001')
  await expect(methods).toContainText('공헌도 10')
  await page.goto('./#/crafting/item/4001')
  await expect(methods).not.toContainText('NPC 구매')
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  expect(errors).toEqual([])
})

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
  await expect(page.locator('.crafting-description')).toContainText('건축에 필요한 목재다')
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

test('Palasi cannon exposes Korean-client enhancement values at +0 and +10', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('./#/crafting/item/49778')
  await expect(page.locator('.crafting-detail h2')).toContainText('팔라시의 함포')
  await expect(page.locator('.crafting-description')).toContainText('필라베르토 팔라시')
  const rows = page.locator('.enhancement-table tbody tr')
  await expect(rows).toHaveCount(11)
  await expect(rows.first()).toContainText('41,220')
  await expect(rows.last()).toContainText('55,220')
  await expect(page.locator('.enhancement-table')).toContainText('수치 미해석')
  await expect(
    page.getByRole('button', { name: '+10 에페리아 중범선 점진: 치로의 함포', exact: true }),
  ).toBeVisible()
  await page.reload()
  await expect(rows).toHaveCount(11)
  expect(errors).toEqual([])
})
