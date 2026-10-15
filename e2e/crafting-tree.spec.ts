import { test, expect } from '@playwright/test'
import { openCraftingNode, supplyRow } from './crafting-helpers'

test('tree explains shared material demand while supply list edits stock and mobile panels switch', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('./#/crafting/plan')
  await page.evaluate(() =>
    localStorage.setItem(
      'bdo-crafting-plan-v1',
      JSON.stringify({
        version: 1,
        goals: [
          { itemId: '4051', name: '녹아내린 철 조각', quantity: 2 },
          { itemId: '11901', name: '루비 귀걸이', quantity: 3 },
        ],
        inventory: {},
        choices: {},
        view: 'direct',
        sort: 'name',
      }),
    ),
  )
  await page.reload()
  const tree = page.locator('.crafting-plan-tree')
  await expect(tree).toBeVisible()
  await expect(tree.locator(':scope > ul > li')).toHaveCount(2)
  await expect(
    tree.locator('.crafting-tree-node-title > strong').filter({ hasText: /^철 광석$/ }),
  ).toHaveCount(2)
  await expect(
    tree.getByRole('button', { name: '공유 재료 · 먼저 나온 경로에서 설정', exact: true }),
  ).toBeVisible()
  const iron = supplyRow(page, '4001')
  await expect(iron).toHaveCount(1)
  await expect(iron.locator('td').nth(1)).toHaveText('40')
  await iron.locator('summary').click()
  await expect(iron).toContainText('녹아내린 철 조각 → 철 광석')
  await expect(iron).toContainText('루비 귀걸이 → 철 광석')
  await expect(iron.getByRole('combobox')).toHaveCount(0)
  await iron.getByRole('spinbutton', { name: '철 광석 제작 재고', exact: true }).fill('7')
  await expect(iron.locator('td').nth(3)).toHaveText('33')
  const root = await openCraftingNode(page, '4051')
  await root
    .getByRole('spinbutton', { name: '녹아내린 철 조각 1회 예상 생산량', exact: true })
    .fill('2')
  await expect(iron.locator('td').nth(1)).toHaveText('35')
  await expect(iron.locator('td').nth(3)).toHaveText('28')
  await page.getByRole('checkbox', { name: '중간 제작품·목표 재고도 보기', exact: true }).check()
  const rootStock = supplyRow(page, '4051').getByRole('spinbutton', {
    name: '녹아내린 철 조각 제작 재고',
    exact: true,
  })
  await rootStock.fill('2')
  await expect(iron.locator('td').nth(1)).toHaveText('30')
  await expect(iron.locator('td').nth(3)).toHaveText('23')
  await rootStock.fill('0')
  await expect(iron.locator('td').nth(1)).toHaveText('35')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(tree).toBeVisible()
  await expect(iron).not.toBeVisible()
  await page.getByRole('tab', { name: '필요 재료', exact: true }).click()
  await expect(tree).not.toBeVisible()
  await expect(iron).toBeVisible()
  await expect(iron.getByRole('spinbutton')).toHaveValue('7')
  await page.getByRole('tab', { name: '제작 트리', exact: true }).click()
  await expect(
    root.getByRole('spinbutton', { name: '녹아내린 철 조각 1회 예상 생산량', exact: true }),
  ).toHaveValue('2')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
})
