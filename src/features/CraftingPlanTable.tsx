import { referenceForPlan, type PlanRow } from '../crafting/planCalculation'
import type { CraftingPlan } from '../crafting/planTypes'
import type { ItemDetail } from '../crafting/types'
import { recipeLabel } from '../crafting/recipeSelection'
import { QuantityInput } from './QuantityInput'
import { yieldModels } from '../crafting/planTypes'
import { yieldModelLabels } from '../crafting/yieldPrediction'
const n = (value: number) => value.toLocaleString('ko-KR')
export function CraftingPlanTable({
  rows,
  crafted,
  plan,
  update,
  names,
  details,
  onSelect,
}: {
  rows: PlanRow[]
  crafted: boolean
  plan: CraftingPlan
  update: (plan: CraftingPlan) => boolean
  names: ReadonlyMap<string, string>
  details?: ReadonlyMap<string, ItemDetail>
  onSelect: (id: string) => void
}) {
  const choiceFor = (row: PlanRow) =>
    plan.choices[row.id] ?? {
      mode: row.mode,
      recipeIndex: row.recipeIndex,
      outputPerCraft: row.outputPerCraft,
    }
  const changeChoice = (row: PlanRow, patch: Partial<CraftingPlan['choices'][string]>) =>
    update({ ...plan, choices: { ...plan.choices, [row.id]: { ...choiceFor(row), ...patch } } })
  const sort = (rows: PlanRow[]) =>
    [...rows].sort((a, b) =>
      plan.sort === 'shortage'
        ? b.shortage - a.shortage || a.name.localeCompare(b.name, 'ko')
        : a.name.localeCompare(b.name, 'ko'),
    )
  return (
    <div className="table-scroll crafting-plan-table">
      <table>
        <thead>
          <tr>
            <th>아이템</th>
            <th>총 필요</th>
            <th>제작 재고</th>
            <th>부족</th>
            <th>획득 방식</th>
            {crafted && (
              <>
                <th>제작식</th>
                <th>1회 예상 생산량</th>
                <th>필요 제작 횟수</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {sort(rows).map((row) => {
            const reference = referenceForPlan(row.id, names)
            const detail = details?.get(reference.id)
            return (
              <tr key={row.id}>
                <td>
                  <button className="crafting-item-link" onClick={() => onSelect(reference.id)}>
                    {row.name}
                  </button>
                  {row.isGoal && <small className="save"> · 목표</small>}
                </td>
                <td>{n(row.required)}</td>
                <td>
                  <QuantityInput
                    min={0}
                    aria-label={`${row.name} 제작 재고`}
                    value={row.owned}
                    onValueChange={(value) =>
                      update({ ...plan, inventory: { ...plan.inventory, [row.id]: value } })
                    }
                  />
                </td>
                <td className={row.shortage ? 'short' : 'save'}>{n(row.shortage)}</td>
                <td>
                  {detail?.recipes.length && !row.enhancementLevel ? (
                    <select
                      aria-label={`${row.name} 획득 방식`}
                      value={row.mode}
                      onChange={(event) =>
                        changeChoice(row, { mode: event.target.value as 'craft' | 'obtain' })
                      }
                    >
                      <option value="craft">직접 제작</option>
                      <option value="obtain">직접 수급·구매</option>
                    </select>
                  ) : row.enhancementLevel ? (
                    '강화 장비 직접 수급'
                  ) : (
                    '직접 수급·구매'
                  )}
                </td>
                {crafted && (
                  <>
                    <td>
                      <select
                        aria-label={`${row.name} 제작식`}
                        value={row.recipeIndex}
                        onChange={(event) =>
                          changeChoice(row, { recipeIndex: Number(event.target.value) })
                        }
                      >
                        {detail?.recipes.map((recipe, index) => (
                          <option key={index} value={index}>
                            {recipeLabel(recipe, index)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <QuantityInput
                        min={0.000001}
                        integer={false}
                        aria-label={`${row.name} 1회 예상 생산량`}
                        value={row.outputPerCraft}
                        readOnly={(plan.choices[row.id]?.yieldModel ?? 'manual') !== 'manual'}
                        onValueChange={(value) =>
                          changeChoice(row, { outputPerCraft: value, yieldConfirmed: true })
                        }
                      />
                      <small className="save">
                        {row.prediction
                          ? `숙련도 모형 · 평균 ${row.outputPerCraft.toFixed(4)}`
                          : row.assumedYield
                            ? '미확보 · 1개 가정'
                            : '사용자 가정값'}
                      </small>
                      <select
                        aria-label={`${row.name} 생산량 모형`}
                        value={plan.choices[row.id]?.yieldModel ?? 'manual'}
                        onChange={(event) =>
                          changeChoice(row, {
                            yieldModel: event.target.value as (typeof yieldModels)[number],
                          })
                        }
                      >
                        {yieldModels.map((model) => (
                          <option key={model} value={model}>
                            {yieldModelLabels[model]}
                          </option>
                        ))}
                      </select>
                      {(plan.choices[row.id]?.yieldModel ?? 'manual') !== 'manual' && (
                        <div className="yield-range">
                          <label>
                            최소{' '}
                            <QuantityInput
                              aria-label={`${row.name} 모형 최소 생산량`}
                              min={0}
                              max={100}
                              value={plan.choices[row.id]?.yieldMin ?? 1}
                              onValueChange={(yieldMin) => changeChoice(row, { yieldMin })}
                            />
                          </label>
                          <label>
                            최대{' '}
                            <QuantityInput
                              aria-label={`${row.name} 모형 최대 생산량`}
                              min={1}
                              max={100}
                              value={
                                plan.choices[row.id]?.yieldMax ??
                                (plan.choices[row.id]?.yieldModel === 'rare-cooking' ? 2 : 4)
                              }
                              onValueChange={(yieldMax) => changeChoice(row, { yieldMax })}
                            />
                          </label>
                        </div>
                      )}
                    </td>
                    <td>
                      {n(row.crafts)}회
                      {row.prediction && (
                        <small className="save">
                          평균 기준 {n(row.meanCrafts ?? row.crafts)}회
                        </small>
                      )}
                    </td>
                  </>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
