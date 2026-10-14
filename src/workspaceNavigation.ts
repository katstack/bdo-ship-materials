export type WorkspaceRoutes = { ships: string; crafting: string }
const key = 'bdo-tools-navigation-v1'
const defaults = (): WorkspaceRoutes => ({ ships: '#/dashboard', crafting: '#/crafting' })
export function loadWorkspaceRoutes(): WorkspaceRoutes {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? '{}') as Partial<WorkspaceRoutes>
    const result = defaults()
    if (
      typeof value?.ships === 'string' &&
      /^#\/(dashboard|fleet|ship|materials|barter|supply|daily|guide|settings)(\/|$)/.test(
        value.ships,
      )
    ) {
      decodeURIComponent(value.ships)
      result.ships = value.ships
    }
    if (typeof value?.crafting === 'string' && /^#\/crafting(\/|$)/.test(value.crafting)) {
      decodeURIComponent(value.crafting)
      result.crafting = value.crafting
    }
    return result
  } catch {
    return defaults()
  }
}
export function saveWorkspaceRoutes(routes: WorkspaceRoutes) {
  try {
    localStorage.setItem(key, JSON.stringify(routes))
  } catch {
    /* optional UI preference, not progress */
  }
}
