import { useEffect, useMemo, useState } from 'react'
import { loadSearchIndex } from '../crafting/catalogClient'
import { useCraftingPlan } from '../crafting/useCraftingPlan'
import type { SearchItem } from '../crafting/types'
import type { AppRoute } from '../routing'
import { CraftingNotesPage } from './CraftingNotesPage'
import { CraftingPlanPage } from './CraftingPlanPage'
import { CraftingEnvironmentPage } from './CraftingEnvironmentPage'

export default function CraftingWorkspace({ route }: { route: AppRoute }) {
  const { plan, update, error } = useCraftingPlan()
  const [index, setIndex] = useState<SearchItem[]>([])
  const [catalogError, setCatalogError] = useState('')
  const [retry, setRetry] = useState(0)
  const [notice, setNotice] = useState('')
  useEffect(() => {
    let active = true
    loadSearchIndex()
      .then((value) => {
        if (active) {
          setIndex(value)
          setCatalogError('')
        }
      })
      .catch((error: unknown) => {
        if (active)
          setCatalogError(error instanceof Error ? error.message : '카탈로그 불러오기 실패')
      })
    return () => {
      active = false
    }
  }, [retry])
  const names = useMemo(() => new Map(index.map((item) => [item.id, item.name])), [index])
  const select = (id: string) => {
    window.location.hash = `/crafting/item/${encodeURIComponent(id)}`
  }
  const add = (
    itemId: string,
    name: string,
    quantity: number,
    recipeIndex: number,
    mode: 'craft' | 'obtain',
  ) => {
    if (plan.goals.length >= 100 && !plan.goals.some((goal) => goal.itemId === itemId)) {
      setNotice('제작 목표는 최대 100종까지 추가할 수 있습니다.')
      return
    }
    const goal = plan.goals.find((goal) => goal.itemId === itemId)
    if ((goal?.quantity ?? 0) + quantity > 1e9) {
      setNotice('목표 수량이 너무 큽니다.')
      return
    }
    const saved = update({
      ...plan,
      goals: goal
        ? plan.goals.map((goal) =>
            goal.itemId === itemId ? { ...goal, quantity: goal.quantity + quantity } : goal,
          )
        : [...plan.goals, { itemId, name, quantity }],
      choices: {
        ...plan.choices,
        [itemId]: {
          ...plan.choices[itemId],
          mode,
          recipeIndex,
          outputPerCraft: plan.choices[itemId]?.outputPerCraft ?? 1,
          yieldConfirmed: plan.choices[itemId]?.yieldConfirmed ?? false,
        },
      },
    })
    if (saved)
      setNotice(`${name} ${quantity.toLocaleString('ko-KR')}개를 제작 계획에 추가했습니다.`)
  }
  return (
    <main className="crafting-workspace">
      <header>
        <div>
          <p className="eyebrow">BLACK DESERT · CRAFTING</p>
          <h1>제작 시뮬레이터</h1>
          <p className="save">아이템 탐색과 다중 제작 계획 · 함선 성장과 독립된 도구</p>
        </div>
      </header>
      <nav aria-label="제작 시뮬레이터 메뉴">
        <a href="#/crafting" className={!route.craftingScreen ? 'active' : ''}>
          제작노트
        </a>
        <a href="#/crafting/plan" className={route.craftingScreen === 'plan' ? 'active' : ''}>
          제작 계획 ({plan.goals.length})
        </a>
        <a
          href="#/crafting/settings"
          className={route.craftingScreen === 'settings' ? 'active' : ''}
        >
          제작 환경
        </a>
      </nav>
      {error && <p role="alert">{error} · 기존 함선 저장 데이터는 변경되지 않았습니다.</p>}
      {catalogError && (
        <p role="alert">
          {catalogError} <button onClick={() => setRetry((value) => value + 1)}>다시 시도</button>
        </p>
      )}
      {notice && (
        <p role="status" className="crafting-plan-notice">
          {notice} <a href="#/crafting/plan">계획 보기</a>
          <button aria-label="추가 안내 닫기" onClick={() => setNotice('')}>
            ×
          </button>
        </p>
      )}
      {route.craftingScreen === 'settings' ? (
        <CraftingEnvironmentPage plan={plan} update={update} />
      ) : route.craftingScreen === 'plan' ? (
        <CraftingPlanPage plan={plan} update={update} names={names} onSelect={select} />
      ) : (
        <CraftingNotesPage
          key={route.itemId ?? 'search'}
          itemId={route.itemId}
          onSelect={select}
          onAddToPlan={add}
        />
      )}
    </main>
  )
}
