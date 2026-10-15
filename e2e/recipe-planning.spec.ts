import { test, expect } from '@playwright/test'

test('recipe-first browsing preserves recipe URL and slot substitution through save, reload and obtain/craft round trips', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('./#/crafting')
  const search = page.getByRole('textbox', { name: '제작노트 레시피 검색', exact: true })
  await search.fill('9202')
  await expect(page.locator('.crafting-results button')).toHaveCount(1)
  await page.locator('.crafting-results button').click()
  await expect(page).toHaveURL(/#\/crafting\/recipe\/recipe-9202-[a-f0-9]+$/)
  const recipeUrl = page.url()
  await page.reload()
  await expect(page).toHaveURL(recipeUrl)
  await expect(page.locator('.crafting-detail h2')).toHaveText('채소 절임')
  await page.getByRole('spinbutton', { name: '제작 목표 수량', exact: true }).fill('10')
  await page.getByRole('button', { name: '제작 계획에 추가', exact: true }).click()
  await page
    .getByRole('navigation', { name: '제작 시뮬레이터 메뉴' })
    .getByRole('link', { name: '제작 계획 (1)', exact: true })
    .click()
  const recipe = page.locator('tr[data-crafting-item-id="9202"]')
  await recipe.locator('.crafting-route-inputs summary').click()
  const substitute = recipe.getByRole('combobox', {
    name: '채소 절임 일반 채소 대체재',
    exact: true,
  })
  await substitute.selectOption('7306')
  const pumpkin = page.locator('tr[data-crafting-item-id="7306"]')
  await expect(pumpkin.locator('td').nth(1)).toHaveText('80')
  await pumpkin.getByRole('spinbutton', { name: '호박 제작 재고', exact: true }).fill('5')
  await expect(pumpkin.locator('td').nth(3)).toHaveText('75')
  await expect(page.locator('.crafting-supply-table tr').filter({ hasText: '호박' })).toContainText(
    '75',
  )
  await page.reload()
  await recipe.locator('.crafting-route-inputs summary').click()
  await expect(substitute).toHaveValue('7306')
  const mode = recipe.getByRole('combobox', { name: '채소 절임 획득 방식', exact: true })
  await mode.selectOption('obtain')
  await expect(mode).toHaveValue('obtain')
  await expect(
    recipe.getByRole('combobox', { name: '채소 절임 제작식', exact: true }),
  ).toBeVisible()
  await substitute.selectOption('7312')
  await mode.selectOption('craft')
  await expect(mode).toHaveValue('craft')
  await expect(page.locator('tr[data-crafting-item-id="7312"] td').nth(1)).toHaveText('80')
  await expect(page.locator('tr[data-crafting-item-id="7306"]')).toHaveCount(0)
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('bdo-crafting-plan-v1')!))
  expect(saved.choices['9202'].recipeId).toMatch(/^recipe-9202-/)
  expect(saved.inventory['7306']).toBe(5)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  expect(errors).toEqual([])
})

test('recipe browser excludes items without recipes and filters recovery separately', async ({
  page,
}) => {
  await page.goto('./#/crafting')
  const search = page.getByRole('textbox', { name: '제작노트 레시피 검색', exact: true })
  await expect(page.locator('.crafting-results button').first()).toBeVisible()
  await search.fill('7306')
  await expect(page.locator('.crafting-results button')).toHaveCount(0)
  await page
    .getByRole('combobox', { name: '레시피 경로 종류', exact: true })
    .selectOption('recovery')
  await search.fill('5960')
  await expect(page.locator('.crafting-results button').first()).toContainText('장비 회수')
  await page.locator('.crafting-results button').first().click()
  await expect(page).toHaveURL(/#\/crafting\/recipe\/recipe-5960-/)
})
