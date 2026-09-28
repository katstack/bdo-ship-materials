import { describe, expect, it } from 'vitest'
import { sampleData } from './sampleData'
import { shipRecipes } from './utils'

describe('combined blue gear and carrack upgrade stage', () => {
  it('shows a trade ship blue gear recipes and its selected carrack upgrade together at stage two', () => {
    const tradeShip = sampleData.ships[0]
    const recipes = shipRecipes(tradeShip)

    expect(recipes.map((recipe) => recipe.id)).toEqual(
      expect.arrayContaining([
        'blue-figure-trade',
        'blue-plating-trade',
        'blue-cannon-trade',
        'blue-sail-trade',
        'advance',
      ]),
    )
  })
})
