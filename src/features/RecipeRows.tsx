import { materialById } from '../catalog'
import type { AppData, Recipe } from '../types'
import { clamp, materialSupply, number } from '../utils'

type RecipeRowsProps = {
  recipe: Recipe
  inventory: Record<string, number>
  setOwned: (id: string, quantity: number) => void
  showSource: (id: string) => void
  data: AppData
  showSupply: (detail: { materialId: string; period: 'daily' | 'weekly' }) => void
}

const Progress = ({ value }: { value: number }) => (
  <div className="progress">
    <i
      className={value === 100 ? 'done' : value >= 70 ? 'near' : ''}
      style={{ width: `${value}%` }}
    />
    <span>{value}%</span>
  </div>
)

export function RecipeRows({
  recipe,
  inventory,
  setOwned,
  showSource,
  data,
  showSupply,
}: RecipeRowsProps) {
  return (
    <div className="recipe-rows">
      <div className="recipe-row-head">
        <span>재료</span>
        <span>필요</span>
        <span>보유</span>
        <span>부족</span>
        <span>진행률</span>
        <span>일일 수급</span>
        <span>주간 수급</span>
        <span>완료까지</span>
        <span>부족분 주화</span>
      </div>
      {recipe.requirements.map((requirement) => {
        const material = materialById[requirement.materialId]
        const owned = clamp(inventory[requirement.materialId])
        const shortage = Math.max(0, requirement.quantity - owned)
        const supply = materialSupply(data, material.id)
        const dailyAverage = supply.daily + supply.weekly / 7
        const days =
          shortage === 0 ? 0 : dailyAverage > 0 ? Math.ceil(shortage / dailyAverage) : undefined
        return (
          <div key={requirement.materialId}>
            <button className="link-button" onClick={() => showSource(material.id)}>
              {material.name}
            </button>
            <span>필요 {number(requirement.quantity)}</span>
            <input
              className="num"
              type="number"
              min="0"
              value={owned}
              onChange={(event) => setOwned(material.id, clamp(event.target.valueAsNumber))}
            />
            <em>{shortage ? `부족 ${number(shortage)}` : '완료'}</em>
            <Progress value={Math.min(100, Math.round((owned / requirement.quantity) * 100))} />
            <button
              className="supply-cell"
              onClick={() => showSupply({ materialId: material.id, period: 'daily' })}
            >
              일 {number(supply.daily)}
            </button>
            <button
              className="supply-cell"
              onClick={() => showSupply({ materialId: material.id, period: 'weekly' })}
            >
              주 {number(supply.weekly)}
            </button>
            <b className={days === undefined && shortage > 0 ? 'no-plan' : ''}>
              {shortage === 0 ? '완료' : days === undefined ? '계획 없음' : `약 ${number(days)}일`}
            </b>
            <b>
              {material.crowCoinPrice === undefined
                ? '—'
                : `${number(shortage * material.crowCoinPrice)} 주화`}
            </b>
          </div>
        )
      })}
    </div>
  )
}
