import type { DemandScope } from './domain/materialDemand'
import type { Ship } from './types'

export type AppTab = 'dashboard' | 'ship' | 'materials' | 'barter' | 'daily' | 'guide' | 'settings'

export type AppRoute = {
  tab: AppTab
  shipId?: string
  scope?: DemandScope
}

const tabs: AppTab[] = ['dashboard', 'ship', 'materials', 'barter', 'daily', 'guide', 'settings']

const asRange = (value?: string): 'current' | 'all' => (value === 'current' ? 'current' : 'all')

function routeForMaterialScope(
  tab: 'materials' | 'barter',
  target?: string,
  third?: string,
  fourth?: string,
): AppRoute {
  if (target === 'ship' && third) {
    return { tab, scope: { target: 'ship', shipId: third, range: asRange(fourth) } }
  }
  return { tab, scope: { target: 'fleet', range: asRange(third) } }
}

export function routeFromHash(hash: string): AppRoute {
  const segments = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)
  const [screen, target, third, fourth, fifth] = segments

  if (screen === 'fleet') return { tab: 'ship', shipId: target }
  if (screen === 'materials') {
    // 기존 하위 탭 URL도 새 물물교환 화면으로 자연스럽게 연결한다.
    const legacyBarter = target === 'ship' ? fifth === 'barter' : fourth === 'barter'
    return routeForMaterialScope(legacyBarter ? 'barter' : 'materials', target, third, fourth)
  }
  if (screen === 'barter') return routeForMaterialScope('barter', target, third, fourth)
  if (screen === 'supply' || screen === 'daily') return { tab: 'daily' }
  if (tabs.includes(screen as AppTab)) return { tab: screen as AppTab }
  return { tab: 'dashboard' }
}

export function hashForRoute({ tab, shipId, scope }: AppRoute): string {
  if (tab === 'ship') return shipId ? `#/fleet/${encodeURIComponent(shipId)}` : '#/fleet'
  if (tab === 'materials' || tab === 'barter') {
    const screen = tab
    if (scope?.target === 'ship') {
      return `#/${screen}/ship/${encodeURIComponent(scope.shipId)}/${scope.range}`
    }
    return `#/${screen}/fleet/${scope?.range ?? 'all'}`
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
