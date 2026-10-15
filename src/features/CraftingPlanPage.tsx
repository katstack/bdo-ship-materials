import { useLayoutEffect, useRef, useState } from 'react'
import { useCraftingCalculation } from '../crafting/useCraftingCalculation'
import { CraftingPlanTree } from './CraftingPlanTree'
import { CraftingSupplySummary } from './CraftingSupplySummary'
import { QuantityInput } from './QuantityInput'
import { parseCraftingPlan } from '../crafting/planStorage'
import { emptyCraftingPlan, type CraftingPlan } from '../crafting/planTypes'
import { defaultRecipeIndex } from '../crafting/recipeSelection'

const n = (value: number) => value.toLocaleString('ko-KR')
export function CraftingPlanPage({
  plan,
  update,
  names,
  onSelect,
}: {
  plan: CraftingPlan
  update: (plan: CraftingPlan) => boolean
  names: ReadonlyMap<string, string>
  onSelect: (id: string) => void
}) {
  const [notice, setNotice] = useState('')
  const [panel, setPanel] = useState<'tree' | 'materials'>('tree')
  const [confirm, setConfirm] = useState<{ type: 'clear' | 'import'; plan?: CraftingPlan }>()
  const importRef = useRef<HTMLInputElement>(null)
  const { current, result, updating, retry } = useCraftingCalculation(plan, names)
  const rootRef = useRef<HTMLElement>(null)
  const anchorRef = useRef<{ id: string; top: number }>(undefined)
  useLayoutEffect(() => {
    const anchor = anchorRef.current
    if (!anchor || updating) return
    anchorRef.current = undefined
    const row = [
      ...(rootRef.current?.querySelectorAll<HTMLElement>('[data-crafting-item-id]') ?? []),
    ].find((element) => element.dataset.craftingItemId === anchor.id)
    if (!row) return
    window.scrollBy({ top: row.getBoundingClientRect().top - anchor.top, behavior: 'instant' })
    row
      .querySelector<HTMLSelectElement>('select[aria-label$="획득 방식"]')
      ?.focus({ preventScroll: true })
  }, [result, updating])
  const exportPlan = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = 'bdo-crafting-plan.json'
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <section
      ref={rootRef}
      aria-busy={updating}
      onChangeCapture={(event) => {
        const target = event.target
        if (
          !(target instanceof HTMLSelectElement) ||
          !target.getAttribute('aria-label')?.endsWith('획득 방식')
        )
          return
        const row = target.closest<HTMLElement>('[data-crafting-item-id]')
        if (row?.dataset.craftingItemId)
          anchorRef.current = {
            id: row.dataset.craftingItemId,
            top: row.getBoundingClientRect().top,
          }
      }}
    >
      <div className="section-title">
        <div>
          <h2>제작 계획</h2>
          <p>여러 목표의 공통 재료를 합산하고, 중간 재료를 제작할지 구매할지 선택합니다.</p>
        </div>
      </div>
      <p className="save">
        함선 재고와 분리된 제작 전용 재고입니다. 이 브라우저에 자동 저장되며 Drive 동기화 대상은
        아닙니다.
      </p>
      <div className="crafting-plan-toolbar">
        <a href="#/crafting">레시피 찾아 추가</a>
        <button onClick={exportPlan}>계획 JSON 내보내기</button>
        <button onClick={() => importRef.current?.click()}>가져오기</button>
        <button onClick={() => setConfirm({ type: 'clear' })}>계획·재고 초기화</button>
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            try {
              if (file.size > 2 * 1024 * 1024)
                throw new Error('제작 계획 파일은 2MB 이하여야 합니다.')
              const imported = parseCraftingPlan(JSON.parse(await file.text()))
              setConfirm({ type: 'import', plan: imported })
              setNotice('')
            } catch (error) {
              setNotice(error instanceof Error ? error.message : '가져오기 실패')
            }
          }}
        />
      </div>
      {notice && <p role="alert">{notice}</p>}
      {!plan.goals.length ? (
        <div className="crafting-empty">
          <h3>제작할 아이템을 추가하세요</h3>
          <p>
            제작노트에서 목표 수량을 입력하고 ‘제작 계획에 추가’를 누르면 여러 아이템의 재료를 한
            번에 볼 수 있습니다.
          </p>
        </div>
      ) : (
        <>
          <h3>목표 아이템 · {n(plan.goals.length)}종</h3>
          <div className="crafting-goals">
            {plan.goals.map((goal) => (
              <div key={goal.itemId} className="crafting-goal">
                <button className="crafting-item-link" onClick={() => onSelect(goal.itemId)}>
                  {goal.name}
                </button>
                <label>
                  목표 수량{' '}
                  <QuantityInput
                    aria-label={`${goal.name} 목표 수량`}
                    value={goal.quantity}
                    onValueChange={(value) => {
                      update({
                        ...plan,
                        goals: plan.goals.map((item) =>
                          item.itemId === goal.itemId ? { ...item, quantity: value } : item,
                        ),
                      })
                    }}
                  />
                </label>
                <label>
                  목표 획득 방식{' '}
                  <select
                    aria-label={`${goal.name} 목표 획득 방식`}
                    value={plan.choices[goal.itemId]?.mode ?? 'craft'}
                    onChange={(event) => {
                      const detail = current?.details?.get(goal.itemId)
                      update({
                        ...plan,
                        choices: {
                          ...plan.choices,
                          [goal.itemId]: {
                            ...(plan.choices[goal.itemId] ?? {
                              recipeIndex: detail ? defaultRecipeIndex(detail) : 0,
                              outputPerCraft: 1,
                            }),
                            mode: event.target.value as 'craft' | 'obtain',
                          },
                        },
                      })
                    }}
                  >
                    <option value="craft">직접 제작</option>
                    <option value="obtain">직접 수급·구매</option>
                  </select>
                </label>
                <button
                  aria-label={`${goal.name} 목표 제거`}
                  onClick={() =>
                    update({
                      ...plan,
                      goals: plan.goals.filter((item) => item.itemId !== goal.itemId),
                    })
                  }
                >
                  제거
                </button>
              </div>
            ))}
          </div>
          <div className="crafting-plan-toolbar">
            <label>
              재료 범위{' '}
              <select
                aria-label="제작 재료 범위"
                value={plan.view}
                onChange={(event) =>
                  update({ ...plan, view: event.target.value as CraftingPlan['view'] })
                }
              >
                <option value="direct">직접 필요한 재료</option>
                <option value="raw">원재료까지 펼치기</option>
              </select>
            </label>
            <label>
              정렬{' '}
              <select
                aria-label="제작 재료 정렬"
                value={plan.sort}
                onChange={(event) =>
                  update({ ...plan, sort: event.target.value as CraftingPlan['sort'] })
                }
              >
                <option value="name">이름순</option>
                <option value="shortage">부족량 많은 순</option>
              </select>
            </label>
          </div>
          <p className="save">
            원재료 범위에서는 중간 재료의 일반 제작식을 우선 선택합니다. 다른 제작식·구매 경로를
            선택할 수 있습니다. 결과 수량 미확보 시 1회당 1개를 가정하므로 예상 생산량을 수정하세요.
            대성공·생산량 변동은 보장하지 않습니다.
          </p>
          <p className="save">
            예측 기준:{' '}
            {plan.environment?.confidence && plan.environment.confidence !== 'mean'
              ? `${plan.environment.confidence}% 조건부 모형 하한 · 실제 게임 성공 보장 아님`
              : '평균 생산량'}{' '}
            · <a href="#/crafting/settings">숙련도·생활 등급 설정</a>
          </p>
          {!current && <p role="status">제작 경로 불러오는 중…</p>}
          {updating && (
            <p role="status" className="crafting-update-status">
              선택한 경로를 불러오는 중… 기존 계산을 표시하고 있습니다.
            </p>
          )}
          {current?.error && (
            <p role="alert">
              {current.error} <button onClick={retry}>다시 시도</button>
            </p>
          )}
          {result?.error && <p role="alert">{result.error}</p>}
          {!!result?.warnings.length && (
            <details className="crafting-calculation-warnings">
              <summary>계산 기준·확인 필요 ({n(result.warnings.length)})</summary>
              <ul>
                {result.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </details>
          )}
          {result && !result.error && result.routes && (
            <div className="crafting-plan-split" data-active-panel={panel}>
              <div className="crafting-plan-panel-tabs" role="tablist" aria-label="제작 계획 보기">
                <button
                  role="tab"
                  aria-selected={panel === 'tree'}
                  aria-controls="crafting-tree-panel"
                  id="crafting-tree-tab"
                  onClick={() => setPanel('tree')}
                >
                  제작 트리
                </button>
                <button
                  role="tab"
                  aria-selected={panel === 'materials'}
                  aria-controls="crafting-materials-panel"
                  id="crafting-materials-tab"
                  onClick={() => setPanel('materials')}
                >
                  필요 재료
                </button>
              </div>
              <section
                className="crafting-tree-panel"
                id="crafting-tree-panel"
                aria-labelledby="crafting-tree-heading"
              >
                <h3 id="crafting-tree-heading">제작 트리</h3>
                <CraftingPlanTree
                  result={result}
                  plan={plan}
                  update={update}
                  names={names}
                  details={current?.details}
                  onSelect={onSelect}
                />
              </section>
              <div className="crafting-materials-panel" id="crafting-materials-panel">
                <CraftingSupplySummary
                  rows={result.rows}
                  result={result}
                  names={names}
                  sort={plan.sort}
                  plan={plan}
                  update={update}
                />
              </div>
            </div>
          )}
        </>
      )}
      {confirm && (
        <div className="crafting-confirm-backdrop">
          <div
            className="crafting-confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="crafting-plan-confirm"
          >
            <h2 id="crafting-plan-confirm">
              {confirm.type === 'clear' ? '제작 계획·재고 초기화' : '제작 계획 가져오기'}
            </h2>
            <p>
              현재 제작 목표·제작 전용 재고·계산 설정을{' '}
              {confirm.type === 'clear' ? '초기화합니다' : '가져온 파일로 교체합니다'}. 함선 진행
              데이터는 변경하지 않습니다. 파일에 제작 환경이 없으면 현재 생활 등급·숙련도를
              유지합니다.
            </p>
            <div className="actions">
              <button
                onClick={() => {
                  const next = confirm.plan ?? emptyCraftingPlan()
                  if (
                    update({
                      ...next,
                      ...(!next.environment && plan.environment
                        ? { environment: plan.environment }
                        : {}),
                    })
                  )
                    setConfirm(undefined)
                }}
              >
                확인
              </button>
              <button onClick={() => setConfirm(undefined)}>취소</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
