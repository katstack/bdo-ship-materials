import { expect, test, type Page } from '@playwright/test'
import { sampleData } from '../src/sampleData'

const api = process.env.VITE_AUTH_API_URL
test.skip(!api, 'Server auth is opt-in; run with VITE_AUTH_API_URL and a matching build.')

async function mockServer(page: Page, connected: boolean, forceDriveRefresh = false) {
  const stats = { tokens: 0, refreshes: 0, uploads: 0, googleIdentity: 0, popups: 0 }
  const remote = structuredClone(sampleData)
  remote.updatedAt = '2026-10-01T00:00:00.000Z'
  remote.inventory.seaweed = 42
  let rejectOnce = forceDriveRefresh
  page.on('popup', () => stats.popups++)
  page.on('request', (request) => {
    if (request.url().includes('accounts.google.com/gsi/')) stats.googleIdentity++
  })
  await page.route(`${api}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname
    const headers = {
      'Access-Control-Allow-Origin': route.request().headers().origin || '*',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'X-BDO-CSRF, Content-Type',
    }
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    if (path === '/auth/token') {
      stats.tokens++
      expect(route.request().headers()['x-bdo-csrf']).toBe('1')
      if (new URL(route.request().url()).searchParams.has('refresh')) stats.refreshes++
      return route.fulfill({
        headers,
        json: { accessToken: `memory-token-${stats.tokens}`, expiresAt: Date.now() + 3600_000 },
      })
    }
    if (path === '/auth/logout') connected = false
    return route.fulfill({ headers, json: { connected } })
  })
  await page.route('https://www.googleapis.com/**', async (route) => {
    if (rejectOnce) {
      rejectOnce = false
      return route.fulfill({ status: 401, json: { error: 'expired' } })
    }
    if (route.request().method() === 'PATCH' || route.request().method() === 'POST') {
      stats.uploads++
      return route.fulfill({ json: { id: 'private-drive-file' } })
    }
    if (new URL(route.request().url()).searchParams.has('alt'))
      return route.fulfill({ json: remote })
    return route.fulfill({ json: { files: [{ id: 'private-drive-file' }] } })
  })
  return stats
}

test('anonymous refresh never opens Google or starts OAuth', async ({ page }) => {
  const stats = await mockServer(page, false)
  await page.goto('./')
  await expect(page.getByRole('button', { name: 'Google 계정 연결', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Google 계정 연결', exact: true })).toBeVisible()
  expect(stats).toMatchObject({ tokens: 0, googleIdentity: 0, popups: 0 })
})

test('restores Drive on a fresh browser, keeps refresh connected and disconnects without losing data', async ({
  page,
}) => {
  const stats = await mockServer(page, true)
  await page.goto('./#/settings')
  await expect(
    page.getByRole('button', { name: 'Google 계정 · 동기화됨', exact: true }),
  ).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem('bdo-ship-materials:v1')!).inventory.seaweed,
      ),
    )
    .toBe(42)
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'Google 계정 · 동기화됨', exact: true }),
  ).toBeVisible()
  expect(stats.uploads).toBe(0)
  expect(stats.googleIdentity).toBe(0)
  expect(stats.popups).toBe(0)
  expect(await page.evaluate(() => localStorage.getItem('bdo-drive-access-token:v1'))).toBeNull()
  await page.getByRole('button', { name: 'Drive 연결 해제', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Google 계정 연결', exact: true })).toBeVisible()
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('bdo-ship-materials:v1')!).inventory.seaweed,
    ),
  ).toBe(42)
})

test('renews a rejected access token without Google UI', async ({ page }) => {
  const stats = await mockServer(page, true, true)
  await page.goto('./')
  await expect(
    page.getByRole('button', { name: 'Google 계정 · 동기화됨', exact: true }),
  ).toBeVisible()
  expect(stats.refreshes).toBe(1)
  expect(stats.googleIdentity).toBe(0)
  expect(stats.popups).toBe(0)
})
