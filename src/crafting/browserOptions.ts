export const browserOptionsKey = 'bdo-crafting-browser-options-v1'

export interface RecipeBrowserOptions {
  showWorkshop: boolean
  showRecovery: boolean
}

export const defaultBrowserOptions: RecipeBrowserOptions = {
  showWorkshop: false,
  showRecovery: false,
}

export function parseBrowserOptions(raw: string | null): RecipeBrowserOptions {
  if (!raw) return { ...defaultBrowserOptions }
  const value: unknown = JSON.parse(raw)
  if (!value || typeof value !== 'object') return { ...defaultBrowserOptions }
  return {
    showWorkshop: 'showWorkshop' in value && value.showWorkshop === true,
    showRecovery: 'showRecovery' in value && value.showRecovery === true,
  }
}

export function isBrowserRecipeVisible(
  recipe: { type: string; kind: string },
  options: RecipeBrowserOptions,
) {
  return (
    (recipe.type !== 'HOUSE' || options.showWorkshop) &&
    (recipe.kind !== 'recovery' || options.showRecovery)
  )
}
