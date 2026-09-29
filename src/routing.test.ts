import { describe, expect, it } from 'vitest'
import { hashForRoute, normalizeRouteForShips, routeFromHash } from './routing'

describe('semantic hash routes', () => {
  it('round-trips a selected ship barter view', () => {
    const route = {
      tab: 'barter' as const,
      scope: { target: 'ship' as const, shipId: 'trade-a', range: 'current' as const },
    }

    expect(hashForRoute(route)).toBe('#/barter/ship/trade-a/current')
    expect(routeFromHash(hashForRoute(route))).toEqual(route)
  })

  it('uses safe defaults for missing or invalid sections', () => {
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
