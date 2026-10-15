import { referenceForPlan, type PlanRow } from '../crafting/planCalculation'
import type { CraftingPlan } from '../crafting/planTypes'
import type { ItemDetail } from '../crafting/types'
import { recipeLabel } from '../crafting/recipeSelection'
import { QuantityInput } from './QuantityInput'
import { yieldModels } from '../crafting/planTypes'
import { yieldModelLabels } from '../crafting/yieldPrediction'
import { recipeRoutes, routeInputs, selectedRecipe } from '../crafting/recipeCatalog'
const n = (value: number) => value.toLocaleString('ko-KR')
export function CraftingPlanTable({
  rows,
  crafted,
  plan,
  update,
  names,
  details,
  onSelect,
  layout = 'table',
}: {
  rows: PlanRow[]
  crafted: boolean
  plan: CraftingPlan
  update: (plan: CraftingPlan) => boolean
  names: ReadonlyMap<string, string>
  details?: ReadonlyMap<string, ItemDetail>
  onSelect: (id: string) => void
  layout?: 'table' | 'node'
}) {
  const choiceFor = (row: PlanRow) =>
    plan.choices[row.id] ?? {
      mode: row.mode,
      recipeIndex: row.recipeIndex,
      recipeId: row.recipeId,
      outputPerCraft: row.prediction ? 1 : row.outputPerCraft,
    }
  const changeChoice = (row: PlanRow, patch: Partial<CraftingPlan['choices'][string]>) =>
    update({
      ...plan,
      choices: {
        ...plan.choices,
        [row.id]: { ...choiceFor(row), recipeId: row.recipeId, ...patch },
      },
    })
  const sort = (rows: PlanRow[]) =>
    [...rows].sort((a, b) =>
      plan.sort === 'shortage'
        ? b.shortage - a.shortage || a.name.localeCompare(b.name, 'ko')
        : a.name.localeCompare(b.name, 'ko'),
    )
  return (
    <div
      className={`table-scroll crafting-plan-table${layout === 'node' ? ' crafting-node-editor' : ''}`}
    >
      <table>
        <thead>
          <tr>
            <th>아이템</th>
            <th>총 필요</th>
            {layout !== 'node' && <th>제작 재고</th>}
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
            const routes = detail ? recipeRoutes(detail, details) : []
            const route = detail ? selectedRecipe(detail, plan.choices[row.id], details) : undefined
            const kinds = {
              production: '제작',
              recovery: '장비 회수',
              byproduct: '부산물',
              exchange: '교환',
            }
            return (
              <tr key={row.id} data-crafting-item-id={row.id}>
                <td>
                  <button className="crafting-item-link" onClick={() => onSelect(reference.id)}>
                    {row.name}
                  </button>
                  {row.isGoal && <small className="save"> · 목표</small>}
                  {!!row.issues.length && (
                    <details className="crafting-route-issues">
                      <summary>경로 확인 {row.issues.length}건</summary>
                      {row.issues.map((issue, index) => (
                        <p key={index}>{issue.message}</p>
                      ))}
                    </details>
                  )}
                </td>
                <td hidden={layout === 'node'}>{n(row.required)}</td>
                {layout !== 'node' && (
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
                )}
                <td hidden={layout === 'node'} className={row.shortage ? 'short' : 'save'}>
                  {n(row.shortage)}
                </td>
                <td data-label="획득 방식">
                  {detail?.recipes.length && !row.enhancementLevel ? (
                    <select
                      aria-label={`${row.name} 획득 방식`}
                      value={plan.choices[row.id]?.mode ?? row.requestedMode}
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
                    <td data-label="제작식">
                      {routes.length ? (
                        <select
                          aria-label={`${row.name} 제작식`}
                          value={plan.choices[row.id]?.recipeId ?? route?.id ?? ''}
                          onChange={(event) => {
                            const selected = routes.find((route) => route.id === event.target.value)
                            if (selected)
                              changeChoice(row, {
                                recipeId: selected.id,
                                recipeIndex: selected.index,
                                yieldModel: undefined,
                                yieldMin: undefined,
                                yieldMax: undefined,
                                yieldConfirmed: false,
                                outputPerCraft: 1,
                              })
                          }}
                        >
                          {!route && (
                            <option value={plan.choices[row.id]?.recipeId ?? ''}>
                              선택한 제작식 없음 · 다시 선택
                            </option>
                          )}
                          {routes.map((route) => (
                            <option key={route.id} value={route.id}>
                              {recipeLabel(route.source, route.index)} · {kinds[route.kind]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="save">등록된 제작식 없음</span>
                      )}
                      {route && (
                        <details className="crafting-route-inputs">
                          <summary>재료·대체재 {route.slots.length}칸</summary>
                          {routeInputs(route, plan.choices[row.id]).map((slot) => (
                            <div className="crafting-slot" key={slot.id}>
                              <label>
                                {slot.group?.label ?? names.get(slot.itemId) ?? slot.itemId} ·{' '}
                                {slot.count ?? '?'}개{' '}
                                {slot.group ? (
                                  <select
                                    aria-label={`${row.name} ${slot.group.label} 대체재`}
                                    value={slot.selectedItemId}
                                    onChange={(event) => {
                                      const choice = choiceFor(row)
                                      changeChoice(row, {
                                        recipeId: route.id,
                                        recipeIndex: route.index,
                                        substitutions: {
                                          ...choice.substitutions,
                                          [route.id]: {
                                            ...choice.substitutions?.[route.id],
                                            [slot.id]: event.target.value,
                                          },
                                        },
                                      })
                                    }}
                                  >
                                    {slot.group.members.map((id) => (
                                      <option value={id} key={id}>
                                        {names.get(id) ?? id}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <span>
                                    {names.get(slot.selectedItemId) ?? slot.selectedItemId}
                                  </span>
                                )}
                              </label>
                              {slot.group && (
                                <small className="save">
                                  일반 등급 1:1 ·{' '}
                                  <a href={slot.group.source} target="_blank" rel="noreferrer">
                                    근거
                                  </a>
                                </small>
                              )}
                            </div>
                          ))}
                        </details>
                      )}
                    </td>
                    <td data-label="1회 예상 생산량">
                      {routes.length ? (
                        <>
                          <QuantityInput
                            min={0.000001}
                            integer={false}
                            aria-label={`${row.name} 1회 예상 생산량`}
                            value={row.outputPerCraft}
                            readOnly={!!row.prediction}
                            onValueChange={(value) =>
                              changeChoice(row, {
                                outputPerCraft: value,
                                yieldConfirmed: true,
                                yieldModel: 'manual',
                              })
                            }
                          />
                          <small className="save">
                            {row.prediction
                              ? `${row.automaticYield ? '제작식 자동' : '숙련도 모형'} · 평균 ${row.outputPerCraft.toFixed(4)}`
                              : row.assumedYield
                                ? '미확보 · 1개 가정'
                                : '사용자 가정값'}
                          </small>
                          <details className="crafting-yield-settings">
                            <summary>생산량 고급 설정</summary>
                            <select
                              aria-label={`${row.name} 생산량 모형`}
                              value={
                                plan.choices[row.id]?.yieldModel ??
                                (row.automaticYield ? 'auto' : 'manual')
                              }
                              onChange={(event) =>
                                changeChoice(row, {
                                  yieldModel:
                                    event.target.value === 'auto'
                                      ? undefined
                                      : (event.target.value as (typeof yieldModels)[number]),
                                  yieldConfirmed:
                                    event.target.value === 'auto'
                                      ? false
                                      : plan.choices[row.id]?.yieldConfirmed,
                                })
                              }
                            >
                              <option value="auto">제작식에 따라 자동 (규칙 없으면 수동)</option>
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
                          </details>
                        </>
                      ) : (
                        <span className="save">—</span>
                      )}
                    </td>
                    <td data-label="필요 제작 횟수">
                      {row.requestedMode === 'craft' ? `${n(row.crafts)}회` : '—'}
                      {row.purchaseRequired > 0 && row.requestedMode === 'craft' && (
                        <small className="short">별도 수급 {n(row.purchaseRequired)}개</small>
                      )}
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
