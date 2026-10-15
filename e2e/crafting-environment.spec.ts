import { test, expect } from '@playwright/test'
import { openCraftingNode, supplyRow } from './crafting-helpers'
test('life profiles persist, select production models, and change conservative material totals', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('./#/crafting/settings')
  await page.getByRole('combobox', { name: '요리 생활 등급', exact: true }).selectOption('master')
  await page.getByRole('spinbutton', { name: '요리 숙련도', exact: true }).fill('1480')
  await expect(
    page.getByText('적용 구간 1,450 · 최대 수량 확률 34.11%', { exact: true }),
  ).toBeVisible()
  await page.getByRole('combobox', { name: '가공 생활 등급', exact: true }).selectOption('master')
  await page.getByRole('spinbutton', { name: '가공 생활 레벨', exact: true }).fill('15')
  await page.getByRole('spinbutton', { name: '가공 숙련도', exact: true }).fill('475')
  await page.getByRole('spinbutton', { name: '가열하기 숙련도', exact: true }).fill('1540')
  await page.reload()
  await expect(page.getByRole('spinbutton', { name: '요리 숙련도', exact: true })).toHaveValue(
    '1480',
  )
  await expect(page.getByRole('spinbutton', { name: '가공 숙련도', exact: true })).toHaveValue(
    '475',
  )
  await page.goto('./#/crafting/item/4051')
  await page.getByRole('spinbutton', { name: '제작 목표 수량', exact: true }).fill('600')
  await page.getByRole('button', { name: '제작 계획에 추가', exact: true }).click()
  await page
    .getByRole('navigation', { name: '제작 시뮬레이터 메뉴' })
    .getByRole('link', { name: '제작 계획 (1)', exact: true })
    .click()
  await openCraftingNode(page, '4051')
  await page.locator('tr[data-crafting-item-id="4051"] .crafting-yield-settings summary').click()
  await page
    .getByRole('combobox', { name: '녹아내린 철 조각 생산량 모형', exact: true })
    .selectOption('processing')
  const iron = supplyRow(page, '4001')
  await expect(iron.locator('td').nth(1)).toHaveText('1,200')
  await page
    .getByRole('navigation', { name: '제작 시뮬레이터 메뉴' })
    .getByRole('link', { name: '제작 환경', exact: true })
    .click()
  await page.getByRole('combobox', { name: '예측 안전 수준', exact: true }).selectOption('95')
  await page
    .getByRole('navigation', { name: '제작 시뮬레이터 메뉴' })
    .getByRole('link', { name: '제작 계획 (1)', exact: true })
    .click()
  const p95 = Number((await iron.locator('td').nth(1).innerText()).replaceAll(',', ''))
  expect(p95).toBeGreaterThan(1200)
  await page
    .getByRole('navigation', { name: '제작 시뮬레이터 메뉴' })
    .getByRole('link', { name: '제작 환경', exact: true })
    .click()
  await page.getByRole('combobox', { name: '예측 안전 수준', exact: true }).selectOption('99')
  await page
    .getByRole('navigation', { name: '제작 시뮬레이터 메뉴' })
    .getByRole('link', { name: '제작 계획 (1)', exact: true })
    .click()
  await expect(iron).toBeVisible()
  const p99 = Number((await iron.locator('td').nth(1).innerText()).replaceAll(',', ''))
  expect(p99).toBeGreaterThanOrEqual(p95)
  await page.reload()
  await openCraftingNode(page, '4051')
  await page.locator('tr[data-crafting-item-id="4051"] .crafting-yield-settings summary').click()
  await expect(
    page.getByRole('combobox', { name: '녹아내린 철 조각 생산량 모형', exact: true }),
  ).toHaveValue('processing')
  await page.getByRole('button', { name: '계획·재고 초기화', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '확인', exact: true }).click()
  await page
    .getByRole('navigation', { name: '제작 시뮬레이터 메뉴' })
    .getByRole('link', { name: '제작 환경', exact: true })
    .click()
  await expect(page.getByRole('spinbutton', { name: '요리 숙련도', exact: true })).toHaveValue(
    '1480',
  )
  await expect(page.getByRole('combobox', { name: '예측 안전 수준', exact: true })).toHaveValue(
    '99',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  expect(errors).toEqual([])
})
