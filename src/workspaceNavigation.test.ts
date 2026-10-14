import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadWorkspaceRoutes, saveWorkspaceRoutes } from './workspaceNavigation'
afterEach(() => vi.unstubAllGlobals())
describe('workspace navigation persistence', () => {
  it('restores each tool route from independent UI preferences', () => {
    const routes = { ships: '#/barter/ship/trade-a/current', crafting: '#/crafting/plan' }
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(routes) })
    expect(loadWorkspaceRoutes()).toEqual(routes)
  })
  it('rejects foreign URLs and malformed escapes', () => {
    for (const value of [
      { ships: 'https://example.com', crafting: 'javascript:bad' },
      { crafting: '#/crafting/item/%ZZ' },
      null,
    ]) {
      vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(value) })
      expect(loadWorkspaceRoutes()).toEqual({ ships: '#/dashboard', crafting: '#/crafting' })
    }
  })
  it('does not break navigation when storage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw Error('blocked')
      },
      setItem: () => {
        throw Error('quota')
      },
    })
    expect(loadWorkspaceRoutes()).toEqual({ ships: '#/dashboard', crafting: '#/crafting' })
    expect(() =>
      saveWorkspaceRoutes({ ships: '#/dashboard', crafting: '#/crafting' }),
    ).not.toThrow()
  })
})
