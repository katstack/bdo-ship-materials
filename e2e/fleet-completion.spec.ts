import { expect, test } from '@playwright/test'
import { sampleData } from '../src/sampleData'

for (const method of ['crafted', 'purchased'] as const) {
  test(`ship completion dialog preserves ${method} inventory semantics and reload state`, async ({
    page,
  }) => {
    const data = structuredClone(sampleData)
    data.ships = data.ships.filter((ship) => ship.id === 'trade-a')
    data.inventory = { pearl: 7, low: 0, combat: 0, moon: 0 }
    await page.addInitScript((initial) => {
      if (!localStorage.getItem('bdo-ship-materials:v1'))
        localStorage.setItem('bdo-ship-materials:v1', JSON.stringify(initial))
    }, data)
    const api = process.env.VITE_AUTH_API_URL
    if (api)
      await page.route(`${api}/**`, (route) =>
        route.fulfill({
          status: route.request().method() === 'OPTIONS' ? 204 : 200,
          headers: {
            'Access-Control-Allow-Origin': route.request().headers().origin || '*',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Allow-Headers': 'X-BDO-CSRF',
          },
          body:
            route.request().method() === 'OPTIONS'
              ? undefined
              : JSON.stringify({ connected: false }),
        }),
      )
    await page.goto('./#/fleet/trade-a')
    const recipe = page
      .locator('article.recipe')
      .filter({ has: page.getByRole('heading', { name: /개량형 장갑/ }) })
    await recipe
      .getByRole('button', { name: method === 'crafted' ? '제작 완료' : '구매 처리', exact: true })
      .click()
    await page
      .getByRole('button', {
        name: method === 'crafted' ? '요구 재료 차감 후 완료' : '재료 유지 후 구매 완료',
        exact: true,
      })
      .click()
    await expect(recipe).toHaveClass(/completed-recipe/)
    await expect
      .poll(() =>
        page.evaluate(
          () => JSON.parse(localStorage.getItem('bdo-ship-materials:v1')!).inventory.pearl,
        ),
      )
      .toBe(method === 'crafted' ? 0 : 7)
    await page.reload()
    await expect(recipe).toHaveClass(/completed-recipe/)
    await expect(page.locator('#current-ship')).toHaveValue('trade-a')
  })
}
