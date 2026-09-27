import type { DemandScope } from './domain/materialDemand'
import type { Ship } from './types'

export type AppTab = 'dashboard' | 'ship' | 'materials' | 'daily' | 'guide' | 'settings'
export type MaterialsView = 'inventory' | 'barter'

export type AppRoute = {
  tab: AppTab
  shipId?: string
  scope?: DemandScope
  materialsView?: MaterialsView
}

const tabs: AppTab[] = ['dashboard', 'ship', 'materials', 'daily', 'guide', 'settings']

const asRange = (value?: string): 'current' | 'all' => (value === 'current' ? 'current' : 'all')
const asMaterialsView = (value?: string): MaterialsView =>
  value === 'barter' ? 'barter' : 'inventory'

export function routeFromHash(hash: string): AppRoute {
  const segments = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)
  const [screen, target, third, fourth, fifth] = segments

  if (screen === 'fleet') return { tab: 'ship', shipId: target }
  if (screen === 'materials') {
    if (target === 'ship' && third) {
      return {
        tab: 'materials',
        scope: { target: 'ship', shipId: third, range: asRange(fourth) },
        materialsView: asMaterialsView(fifth),
      }
    }
    return {
      tab: 'materials',
      scope: { target: 'fleet', range: asRange(third) },
      materialsView: asMaterialsView(fourth),
    }
  }
  if (screen === 'supply' || screen === 'daily') return { tab: 'daily' }
  if (tabs.includes(screen as AppTab)) return { tab: screen as AppTab }
  return { tab: 'dashboard' }
}

export function hashForRoute({ tab, shipId, scope, materialsView }: AppRoute): string {
  if (tab === 'ship') return shipId ? `#/fleet/${encodeURIComponent(shipId)}` : '#/fleet'
  if (tab === 'materials') {
    const view = materialsView === 'barter' ? 'barter' : 'inventory'
    if (scope?.target === 'ship') {
      return `#/materials/ship/${encodeURIComponent(scope.shipId)}/${scope.range}/${view}`
    }
    return `#/materials/fleet/${scope?.range ?? 'all'}/${view}`
  }
  if (tab === 'daily') return '#/supply'
  return `#/${tab}`
}

/** Removes stale ship references from a bookmark after a ship was deleted locally. */
export function normalizeRouteForShips(route: AppRoute, ships: Ship[]): AppRoute {
  const fallbackShipId = ships[0]?.id
  const requestedShipId =
    route.shipId ?? (route.scope?.target === 'ship' ? route.scope.shipId : undefined)
  const shipId = ships.some((ship) => ship.id === requestedShipId)
    ? requestedShipId
    : fallbackShipId

  if (route.tab === 'ship') return { ...route, shipId }
  if (route.scope?.target === 'ship') {
    return shipId
      ? { ...route, scope: { ...route.scope, shipId } }
      : { ...route, scope: { target: 'fleet', range: route.scope.range } }
  }
  return route
}
