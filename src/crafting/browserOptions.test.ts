import { describe, expect, it } from 'vitest'
import {
  defaultBrowserOptions,
  isBrowserRecipeVisible,
  parseBrowserOptions,
} from './browserOptions'

describe('recipe browser optional routes', () => {
  it('hides workshop and recovery by default while keeping ordinary recipes', () => {
    expect(parseBrowserOptions(null)).toEqual(defaultBrowserOptions)
    expect(
      isBrowserRecipeVisible({ type: 'HOUSE', kind: 'production' }, defaultBrowserOptions),
    ).toBe(false)
    expect(isBrowserRecipeVisible({ type: 'HEAT', kind: 'recovery' }, defaultBrowserOptions)).toBe(
      false,
    )
    expect(
      isBrowserRecipeVisible({ type: 'HEAT', kind: 'production' }, defaultBrowserOptions),
    ).toBe(true)
  })
  it('enables each option independently and accepts only boolean true', () => {
    const workshop = parseBrowserOptions('{"showWorkshop":true,"showRecovery":"true"}')
    expect(isBrowserRecipeVisible({ type: 'HOUSE', kind: 'production' }, workshop)).toBe(true)
    expect(isBrowserRecipeVisible({ type: 'HEAT', kind: 'recovery' }, workshop)).toBe(false)
    const recovery = parseBrowserOptions('{"showRecovery":true}')
    expect(isBrowserRecipeVisible({ type: 'HOUSE', kind: 'production' }, recovery)).toBe(false)
    expect(isBrowserRecipeVisible({ type: 'HEAT', kind: 'recovery' }, recovery)).toBe(true)
    expect(parseBrowserOptions('null')).toEqual(defaultBrowserOptions)
    expect(() => parseBrowserOptions('{')).toThrow()
  })
})
