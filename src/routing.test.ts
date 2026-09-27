import { describe, expect, it } from 'vitest'
import { hashForRoute, routeFromHash } from './routing'

describe('semantic hash routes', () => {
  it('round-trips a selected ship material view', () => {
    const route = {
      tab: 'materials' as const,
      scope: { target: 'ship' as const, shipId: 'trade-a', range: 'current' as const },
      materialsView: 'barter' as const,
    }

    expect(hashForRoute(route)).toBe('#/materials/ship/trade-a/current/barter')
    expect(routeFromHash(hashForRoute(route))).toEqual(route)
  })

  it('uses safe defaults for missing or invalid sections', () => {
    expect(routeFromHash('')).toEqual({ tab: 'dashboard' })
    expect(routeFromHash('#/materials/fleet')).toEqual({
      tab: 'materials',
      scope: { target: 'fleet', range: 'all' },
      materialsView: 'inventory',
    })
  })
})
