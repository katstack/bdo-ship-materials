import { describe, expect, it } from 'vitest'
import { stageLabelForHull, stagesForHull } from './catalog'
import { sampleData } from './sampleData'
import { shipRecipes } from './utils'

describe('combined blue gear and carrack upgrade stage', () => {
  it('shows only the stages applicable to the current hull', () => {
    expect(stagesForHull('bartali')).toEqual([1])
    expect(stagesForHull('trade')).toEqual([1, 2])
    expect(stagesForHull('advance')).toEqual([3, 4])
    expect(stageLabelForHull('bartali', 1)).toBe('에페리아 경범선/호위함 증축')
  })

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
