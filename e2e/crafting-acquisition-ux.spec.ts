import { test, expect } from '@playwright/test'

test('switching acquisition keeps tables visible and preserves the moved row position and focus', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 640 })
  await page.goto('./#/crafting/plan')
  await page.evaluate(() =>
    localStorage.setItem(
      'bdo-crafting-plan-v1',
      JSON.stringify({
        version: 1,
        goals: [
          { itemId: '4051', name: '녹아내린 철 조각', quantity: 600 },
          { itemId: '11901', name: '루비 귀걸이', quantity: 300 },
        ],
        choices: {},
        inventory: {},
        view: 'direct',
        sort: 'name',
      }),
    ),
  )
  await page.reload()
  const mode = page.getByRole('combobox', { name: '녹아내린 철 조각 획득 방식', exact: true })
  await expect(mode).toHaveValue('craft')
  await mode.scrollIntoViewIfNeeded()
  await page.evaluate(() => {
    const state = { blanks: 0 }
    Object.assign(window, { acquisitionUx: state })
    new MutationObserver(() => {
      if (!document.querySelector('.crafting-plan-table table')) state.blanks++
    }).observe(document.body, { childList: true, subtree: true })
  })
  for (const value of ['obtain', 'craft', 'obtain', 'craft']) {
    await mode.scrollIntoViewIfNeeded()
    const before = await mode.locator('xpath=ancestor::tr').boundingBox()
    await mode.selectOption(value)
    await expect(mode).toHaveValue(value)
    await expect(mode).toBeFocused()
    const after = await mode.locator('xpath=ancestor::tr').boundingBox()
    expect(Math.abs(after!.y - before!.y)).toBeLessThan(3)
    await expect(page.getByText('제작 경로 불러오는 중…', { exact: true })).toHaveCount(0)
    // Wait beyond the old dependency-loader debounce to catch the former blank phase.
    await page.waitForTimeout(200)
  }
  expect(
    await page.evaluate(
      () => (window as Window & { acquisitionUx?: { blanks: number } }).acquisitionUx?.blanks,
    ),
  ).toBe(0)
  await page.reload()
  await expect(mode).toHaveValue('craft')
})
