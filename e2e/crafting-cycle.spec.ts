import { test, expect } from '@playwright/test'

for (const view of ['direct', 'raw']) {
  test(`frigate ${view} plan remains usable when recovery recipes form a cycle`, async ({
    page,
  }) => {
    await page.goto('./#/crafting/plan')
    await page.evaluate((view) => {
      const choices = Object.fromEntries(
        ['5860', '9733', '5960', '10006', '4062'].map((id) => [
          id,
          { mode: 'craft', recipeIndex: 0, outputPerCraft: 1 },
        ]),
      )
      localStorage.setItem(
        'bdo-crafting-plan-v1',
        JSON.stringify({
          version: 1,
          goals: [{ itemId: '49009', name: '선박 등록증: 에페리아 호위함', quantity: 1 }],
          choices,
          inventory: {},
          view,
          sort: 'name',
        }),
      )
    }, view)
    await page.reload()
    const trace = page.locator('tr[data-crafting-item-id="5960"]')
    await expect(trace).toBeVisible()
    await expect(
      trace.getByRole('combobox', { name: '자연의 흔적 획득 방식', exact: true }),
    ).toHaveValue('craft')
    await trace
      .getByRole('combobox', { name: '자연의 흔적 획득 방식', exact: true })
      .selectOption('obtain')
    await expect(
      trace.getByRole('combobox', { name: '자연의 흔적 획득 방식', exact: true }),
    ).toHaveValue('obtain')
    await expect(
      trace.getByRole('combobox', { name: '자연의 흔적 제작식', exact: true }),
    ).toBeVisible()
    await trace
      .getByRole('combobox', { name: '자연의 흔적 획득 방식', exact: true })
      .selectOption('craft')
    await expect(
      trace.getByRole('combobox', { name: '자연의 흔적 획득 방식', exact: true }),
    ).toHaveValue('craft')
    const amount = Number((await trace.locator('td').nth(1).textContent())!.replaceAll(',', ''))
    expect(amount).toBeGreaterThan(0)
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(
      page.getByRole('spinbutton', {
        name: '선박 등록증: 에페리아 호위함 1회 예상 생산량',
        exact: true,
      }),
    ).toBeVisible()
    await expect(page.locator('tr[data-crafting-item-id="4921"] td').nth(1)).toHaveText('25')
    const saved = await page.evaluate(
      () => JSON.parse(localStorage.getItem('bdo-crafting-plan-v1')!).choices['5960'].mode,
    )
    expect(saved).toBe('craft') // Cycle fallback is derived; never rewrite the user's saved choices.
  })
}
