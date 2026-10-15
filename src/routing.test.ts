import { describe, expect, it } from 'vitest'
import { hashForRoute, normalizeRouteForShips, routeFromHash } from './routing'

describe('semantic hash routes', () => {
  it('restores a selected recipe without relying on its array position', () => {
    const route = { tab: 'crafting' as const, itemId: '9202', recipeId: 'recipe-9202-aabbccdd' }
    expect(routeFromHash(hashForRoute(route))).toEqual(route)
    expect(routeFromHash('#/crafting/recipe/not-a-recipe')).toEqual({
      tab: 'crafting',
      itemId: undefined,
    })
  })
  it('keeps independent crafting plan bookmarks', () => {
    expect(routeFromHash(hashForRoute({ tab: 'crafting', craftingScreen: 'settings' }))).toEqual({
      tab: 'crafting',
      craftingScreen: 'settings',
    })
    const route = { tab: 'crafting' as const, craftingScreen: 'plan' as const }
    expect(hashForRoute(route)).toBe('#/crafting/plan')
    expect(normalizeRouteForShips(routeFromHash('#/crafting/plan'), [])).toEqual(route)
  })
  it('restores crafting item links independently of the selected ship', () => {
    const route = { tab: 'crafting' as const, itemId: '768190' }
    expect(hashForRoute(route)).toBe('#/crafting/item/768190')
    expect(normalizeRouteForShips(routeFromHash(hashForRoute(route)), [])).toEqual(route)
  })
  it('round-trips a selected ship barter view', () => {
    const route = {
      tab: 'barter' as const,
      scope: { target: 'ship' as const, shipId: 'trade-a', range: 'current' as const },
    }

    expect(hashForRoute(route)).toBe('#/barter/ship/trade-a/current')
    expect(routeFromHash(hashForRoute(route))).toEqual(route)
  })

  it('uses safe defaults for missing or invalid sections', () => {
    expect(routeFromHash('#/crafting/item/%ZZ')).toEqual({ tab: 'dashboard' })
    expect(routeFromHash('')).toEqual({ tab: 'dashboard' })
    expect(routeFromHash('#/materials/fleet')).toEqual({
      tab: 'materials',
      scope: { target: 'fleet', range: 'all' },
    })
  })

  it('keeps legacy material barter links and replaces deleted ships', () => {
    expect(
      normalizeRouteForShips(routeFromHash('#/materials/ship/removed/current/barter'), [
        {
          id: 'trade-a',
          name: '무역선 A',
          hull: 'trade',
          activeStage: 1,
          upgradeHull: 'advance',
          equipmentOrder: ['plating', 'cannon', 'figurehead', 'sail'],
        },
      ]),
    ).toEqual({
      tab: 'barter',
      scope: { target: 'ship', shipId: 'trade-a', range: 'current' },
    })
  })
})
