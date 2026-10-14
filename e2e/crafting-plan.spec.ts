import { test, expect } from '@playwright/test'

test('quantity editing replaces defaults and permits clearing before typing', async ({ page }) => {
  await page.goto('./#/crafting/item/4051')
  const quantity = page.getByRole('spinbutton', { name: '제작 목표 수량', exact: true })
  await expect(quantity).toHaveValue('1')
  await quantity.click()
  await quantity.pressSequentially('600')
  await expect(quantity).toHaveValue('600')
  await quantity.blur()
  await quantity.click()
  await quantity.press('Backspace')
  await expect(quantity).toHaveValue('')
  await quantity.pressSequentially('800')
  await expect(quantity).toHaveValue('800')
  await page.getByRole('button', { name: '제작 계획에 추가', exact: true }).click()
  await page
    .getByRole('navigation', { name: '제작 시뮬레이터 메뉴' })
    .getByRole('link', { name: '제작 계획 (1)', exact: true })
    .click()
  const goal = page.getByRole('spinbutton', { name: '녹아내린 철 조각 목표 수량', exact: true })
  await goal.click()
  await goal.pressSequentially('600')
  await expect(goal).toHaveValue('600')
  await goal.blur()
  const yieldInput = page.getByRole('spinbutton', {
    name: '녹아내린 철 조각 1회 예상 생산량',
    exact: true,
  })
  await yieldInput.click()
  await yieldInput.pressSequentially('2.5')
  await expect(yieldInput).toHaveValue('2.5')
  await yieldInput.blur()
  const stock = page.getByRole('spinbutton', { name: '철 광석 제작 재고', exact: true })
  await stock.click()
  await stock.pressSequentially('800')
  await expect(stock).toHaveValue('800')
  await stock.blur()
  await goal.click()
  await goal.press('Backspace')
  await expect(goal).toHaveValue('')
  await goal.blur()
  await expect(goal).toHaveValue('600')
  await page.reload()
  await expect(goal).toHaveValue('600')
  await expect(stock).toHaveValue('800')
})

test('multiple crafting goals aggregate materials, persist independently and restore tool routes', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('./#/crafting/item/4051')
  await expect(page.locator('.crafting-detail h2')).toHaveText('녹아내린 철 조각')
  await page.getByRole('spinbutton', { name: '제작 목표 수량', exact: true }).fill('2')
  await page.getByRole('button', { name: '제작 계획에 추가', exact: true }).click()
  await page.goto('./#/crafting/item/11901')
  await expect(page.locator('.crafting-detail h2')).toHaveText('루비 귀걸이')
  await page.getByRole('spinbutton', { name: '제작 목표 수량', exact: true }).fill('3')
  await page.getByRole('button', { name: '제작 계획에 추가', exact: true }).click()
  await page
    .getByRole('navigation', { name: '제작 시뮬레이터 메뉴' })
    .getByRole('link', { name: '제작 계획 (2)', exact: true })
    .click()
  await expect(page).toHaveURL(/#\/crafting\/plan$/)
  const iron = page
    .locator('.crafting-plan-table tr')
    .filter({ has: page.getByRole('button', { name: '철 광석', exact: true }) })
  await expect(iron.locator('td').nth(1)).toHaveText('40')
  await iron.getByRole('spinbutton', { name: '철 광석 제작 재고', exact: true }).fill('7')
  await expect(iron.locator('td').nth(3)).toHaveText('33')
  await page
    .getByRole('spinbutton', { name: '녹아내린 철 조각 1회 예상 생산량', exact: true })
    .fill('2')
  await expect(iron.locator('td').nth(1)).toHaveText('35')
  await expect(iron.locator('td').nth(3)).toHaveText('28')
  await page.getByRole('combobox', { name: '제작 재료 정렬', exact: true }).selectOption('shortage')
  await page.reload()
  await expect(iron.locator('td').nth(1)).toHaveText('35')
  await expect(page.getByRole('combobox', { name: '제작 재료 정렬', exact: true })).toHaveValue(
    'shortage',
  )
  await expect(
    page.getByRole('spinbutton', { name: '철 광석 제작 재고', exact: true }),
  ).toHaveValue('7')
  await page
    .getByRole('navigation', { name: '도구 선택' })
    .getByRole('link', { name: '함선 성장', exact: true })
    .click()
  await expect(page.locator('h1')).toHaveText('함선 성장 재료 관리')
  await page.getByRole('button', { name: '전체 재료', exact: true }).click()
  await expect(page).toHaveURL(/#\/materials\/fleet\/all$/)
  await page.locator('.material-table input[type="number"]').first().fill('17')
  expect(await page.evaluate(() => localStorage.getItem('bdo-ship-materials:v1'))).toBeTruthy()
  const shipState = await page.evaluate(() => ({ ...localStorage }))
  await page
    .getByRole('navigation', { name: '도구 선택' })
    .getByRole('link', { name: '제작 시뮬레이터', exact: true })
    .click()
  await expect(page).toHaveURL(/#\/crafting\/plan$/)
  await expect(iron.locator('td').nth(1)).toHaveText('35')
  await page.reload()
  await expect(iron.locator('td').nth(1)).toHaveText('35')
  await expect(
    page
      .getByRole('navigation', { name: '도구 선택' })
      .getByRole('link', { name: '함선 성장', exact: true }),
  ).toHaveAttribute('href', '#/materials/fleet/all')
  await page.getByRole('button', { name: '계획·재고 초기화', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '취소', exact: true }).click()
  await expect(iron.locator('td').nth(1)).toHaveText('35')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '계획 JSON 내보내기', exact: true }).click()
  expect((await downloadPromise).suggestedFilename()).toBe('bdo-crafting-plan.json')
  await page.getByRole('button', { name: '계획·재고 초기화', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '확인', exact: true }).click()
  await expect(page.getByRole('heading', { name: '제작할 아이템을 추가하세요' })).toBeVisible()
  const after = await page.evaluate(() => ({ ...localStorage }))
  for (const [key, value] of Object.entries(shipState))
    if (key !== 'bdo-crafting-plan-v1') expect(after[key]).toBe(value)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  expect(errors).toEqual([])
})

test('raw materials and independent JSON import retain settings without overwriting on invalid input', async ({
  page,
}) => {
  await page.goto('./#/crafting/plan')
  const plan = {
    version: 1,
    goals: [{ itemId: '4051', name: '녹아내린 철 조각', quantity: 2 }],
    choices: {},
    inventory: { '4001': 3 },
    view: 'raw',
    sort: 'shortage',
  }
  await page.locator('input[type="file"]').setInputFiles({
    name: 'plan.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(plan)),
  })
  await page.getByRole('dialog').getByRole('button', { name: '확인', exact: true }).click()
  const iron = page
    .locator('.crafting-plan-table tr')
    .filter({ has: page.getByRole('button', { name: '철 광석', exact: true }) })
  await expect(iron.locator('td').nth(1)).toHaveText('10')
  await expect(iron.locator('td').nth(3)).toHaveText('7')
  await expect(page.getByRole('combobox', { name: '제작 재료 범위', exact: true })).toHaveValue(
    'raw',
  )
  const before = await page.evaluate(() => localStorage.getItem('bdo-crafting-plan-v1'))
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{bad') })
  await expect(page.getByRole('alert')).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('bdo-crafting-plan-v1'))).toBe(before)
  await page.reload()
  await expect(iron.locator('td').nth(1)).toHaveText('10')
  await expect(page.getByRole('combobox', { name: '제작 재료 범위', exact: true })).toHaveValue(
    'raw',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  const viewport = page.locator('.crafting-plan-table').first()
  expect(await viewport.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true)
})
