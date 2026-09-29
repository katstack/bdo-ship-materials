import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  dailyTasks,
  defaultEquipmentOrder,
  defaultUpgradeHull,
  hullLabel,
  materials,
  materialById,
  stageLabel,
  upgradeTargets,
} from './catalog'
import { clearData, freshSample, hasStoredData, loadData, normalize, saveData } from './storage'
import { useDriveSync } from './useDriveSync'
import type {
  AggregateMaterial,
  AppData,
  DailyTask,
  Hull,
  MaterialExchangeSortKey,
  MaterialSortKey,
  Ship,
  Stage,
} from './types'
import { clamp, number, materialSupply, recipeProgress, shipRecipes, stageProgress } from './utils'
import {
  aggregateMaterialDemand as aggregate,
  demandScopeLabel,
  fleetDemandScope,
  shipDemandScope,
  type DemandScope,
} from './domain/materialDemand'
import {
  canCompleteRecipe,
  canCompleteRecipeForShip,
  completeRecipe,
  craftRecordKey,
  isRecipeCompleted,
  undoRecipeCompletion,
} from './domain/crafting'
import { locationById, locations } from './data/locations'
import { npcById } from './data/npcs'
import { questRoutes } from './data/questRoutes'
import { codexNpcUrl } from './data/codex'
import type { QuestRoute } from './types'
import { materialExchangeKey, materialExchangeOutputOptions } from './data/materialExchanges'
import { GuidePage } from './features/GuidePage'
import { BarterSessionControls } from './features/BarterSessionControls'
import { BarterPriorityTable, type BarterRow } from './features/BarterPriorityTable'
import { MaterialTable } from './features/MaterialTable'
import { QuestPlanCard } from './features/QuestPlanCard'
import { RecipeRows } from './features/RecipeRows'
import { SettingsPage } from './features/SettingsPage'
import { hashForRoute, normalizeRouteForShips, routeFromHash, type AppTab } from './routing'

const toBarterRows = (
  rows: AggregateMaterial[],
  exchangeCounts: Record<string, number> = {},
): BarterRow[] =>
  rows
    .filter(
      (row) =>
        row.shortage > 0 ||
        materialExchangeOutputOptions(row.id).some((outputQuantity) => {
          const key =
            materialExchangeOutputOptions(row.id).length === 1
              ? row.id
              : materialExchangeKey(row.id, outputQuantity)
          return (exchangeCounts[key] || 0) > 0
        }),
    )
    .flatMap((row) => {
      const outputOptions = materialExchangeOutputOptions(row.id)
      return outputOptions.map((outputQuantity) => {
        const gained = Math.min(outputQuantity, row.shortage)
        const afterExchangeShortage = row.shortage - gained
        const afterProgress = row.required
          ? Math.min(100, Math.round(((row.owned + gained) / row.required) * 100))
          : 100
        const exchangeCrowValue =
          row.crowCoinPrice === undefined ? undefined : gained * row.crowCoinPrice
        return {
          ...row,
          exchangeKey:
            outputOptions.length === 1 ? row.id : materialExchangeKey(row.id, outputQuantity),
          outputQuantity,
          variableOutput: outputOptions.length > 1,
          afterExchangeShortage,
          progressGain: afterProgress - row.progress,
          exchangeCrowValue,
          priority: exchangeCrowValue ?? -1,
        }
      })
    })
const sortBarterRows = (
  rows: BarterRow[],
  key: MaterialExchangeSortKey,
  direction: 'asc' | 'desc',
) =>
  [...rows].sort((a, b) => {
    const av = key === 'name' ? a.name : a[key]
    const bv = key === 'name' ? b.name : b[key]
    if (av === undefined) return 1
    if (bv === undefined) return -1
    const base =
      typeof av === 'string' && typeof bv === 'string'
        ? av.localeCompare(bv, 'ko')
        : Number(av) - Number(bv)
    return direction === 'asc' ? base : -base
  })
const id = () => crypto.randomUUID()
const Progress = ({ value }: { value: number }) => (
  <div className="progress">
    <i
      className={value === 100 ? 'done' : value >= 70 ? 'near' : ''}
      style={{ width: `${value}%` }}
    />
    <span>{value}%</span>
  </div>
)
const newShip = (hull: Hull): Ship => ({
  id: id(),
  name: `${hullLabel[hull]} ${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`,
  hull,
  activeStage: hull === 'trade' || hull === 'warship' ? 1 : 3,
  upgradeHull: hull === 'trade' || hull === 'warship' ? defaultUpgradeHull[hull] : undefined,
  equipmentOrder: [...defaultEquipmentOrder[hull]],
})
const sortMaterials = (
  rows: ReturnType<typeof aggregate>,
  key: MaterialSortKey,
  direction: 'asc' | 'desc',
) =>
  [...rows].sort((a, b) => {
    const av = key === 'recipes' ? a.recipes.join(', ') : a[key]
    const bv = key === 'recipes' ? b.recipes.join(', ') : b[key]
    if (av === undefined) return 1
    if (bv === undefined) return -1
    const base =
      typeof av === 'string' && typeof bv === 'string'
        ? av.localeCompare(bv, 'ko')
        : Number(av) - Number(bv)
    return direction === 'asc' ? base : -base
  })

export default function App() {
  const [data, setData] = useState<AppData>(loadData)
  const [hasLocalProgress, setHasLocalProgress] = useState(hasStoredData)
  const initialRoute = normalizeRouteForShips(routeFromHash(window.location.hash), data.ships)
  const [tab, setTab] = useState<AppTab>(initialRoute.tab)
  const [selected, setSelected] = useState(() => {
    const shipId =
      initialRoute.shipId ??
      (initialRoute.scope?.target === 'ship' ? initialRoute.scope.shipId : undefined)
    return data.ships.some((ship) => ship.id === shipId) ? shipId! : data.ships[0]?.id || ''
  })
  const [scope, setScope] = useState<DemandScope>(initialRoute.scope ?? fleetDemandScope('all'))
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  const [barterToast, setBarterToast] = useState<{
    id: string
    materialId: string
    quantity: number
  } | null>(null)
  const [barterFlashId, setBarterFlashId] = useState<string | null>(null)
  const [craftConfirm, setCraftConfirm] = useState<{ shipId: string; recipeId: string } | null>(
    null,
  )
  const [source, setSource] = useState<string | null>(null)
  const [supplyDetail, setSupplyDetail] = useState<{
    materialId: string
    period: 'daily' | 'weekly'
  } | null>(null)
  const [manualAdds, setManualAdds] = useState<Record<string, string>>({})
  const importRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const hash = hashForRoute({ tab, shipId: selected, scope })
    if (window.location.hash !== hash) window.history.replaceState(null, '', hash)
  }, [tab, selected, scope])
  useEffect(() => {
    const restoreRouteState = () => {
      const route = normalizeRouteForShips(routeFromHash(window.location.hash), data.ships)
      setTab(route.tab)
      if (route.scope) setScope(route.scope)
      const shipId =
        route.shipId ?? (route.scope?.target === 'ship' ? route.scope.shipId : undefined)
      setSelected(data.ships.some((ship) => ship.id === shipId) ? shipId! : data.ships[0]?.id || '')
    }
    window.addEventListener('hashchange', restoreRouteState)
    window.addEventListener('popstate', restoreRouteState)
    return () => {
      window.removeEventListener('hashchange', restoreRouteState)
      window.removeEventListener('popstate', restoreRouteState)
    }
  }, [data.ships])
  const update = (next: AppData) => {
    const stamped = { ...next, updatedAt: new Date().toISOString() }
    setData(stamped)
    setHasLocalProgress(true)
    try {
      saveData(stamped)
      setNotice('로컬 저장됨')
    } catch (e) {
      setNotice(e instanceof Error ? e.message : '저장 실패')
    }
  }
  const replaceLocal = (next: AppData) => {
    setData(next)
    setHasLocalProgress(true)
    saveData(next)
    setNotice('Drive 데이터를 불러왔습니다.')
  }
  const drive = useDriveSync(data, replaceLocal, hasLocalProgress)
  const totals = useMemo(() => aggregate(data, scope), [data, scope])
  const allTotals = useMemo(() => aggregate(data, fleetDemandScope('all')), [data])
  const orderedTotals = sortMaterials(totals, data.materialSort.key, data.materialSort.direction)
  const barterRows = useMemo(
    () => toBarterRows(totals, data.barterSession.exchangeCounts),
    [totals, data.barterSession.exchangeCounts],
  )
  const orderedBarterRows = sortBarterRows(
    barterRows,
    data.materialExchangeSort.key,
    data.materialExchangeSort.direction,
  )
  const currentShip = data.ships.find((s) => s.id === selected)
  const currentRecipes = currentShip
    ? [...shipRecipes(currentShip)].sort(
        (a, b) =>
          (a.slot ? currentShip.equipmentOrder.indexOf(a.slot) : 99) -
          (b.slot ? currentShip.equipmentOrder.indexOf(b.slot) : 99),
      )
    : []
  const pendingRecipes = currentShip
    ? currentRecipes.filter((recipe) => !isRecipeCompleted(data, currentShip.id, recipe.id))
    : []
  const completedCurrentRecipes = currentShip
    ? currentRecipes.filter((recipe) => isRecipeCompleted(data, currentShip.id, recipe.id))
    : []
  const totalCrow = totals.reduce((s, x) => s + (x.crowCoinTotal || 0), 0)
  const priced = totals.filter((x) => x.crowCoinPrice !== undefined).length
  const setOwned = (materialId: string, value: number) =>
    update({ ...data, inventory: { ...data.inventory, [materialId]: value } })
  const completeCraft = () => {
    if (!craftConfirm) return
    const ship = data.ships.find((item) => item.id === craftConfirm.shipId)
    const recipe = ship && shipRecipes(ship).find((item) => item.id === craftConfirm.recipeId)
    if (!ship || !recipe || isRecipeCompleted(data, ship.id, recipe.id))
      return setCraftConfirm(null)
    if (!canCompleteRecipeForShip(data, ship.id, recipe)) {
      setNotice('선행 에페리아 함선 장비 제작을 모두 완료해야 증축할 수 있습니다.')
      return setCraftConfirm(null)
    }
    update(completeRecipe(data, ship.id, recipe))
    setCraftConfirm(null)
    setNotice(`${recipe.name} 제작 완료 · 요구 재료를 공유 재고에서 차감 처리했습니다.`)
  }
  const undoCraft = (ship: Ship, recipeId: string) => {
    const key = craftRecordKey(ship.id, recipeId)
    const record = data.completedRecipes[key]
    if (!record || !confirm('제작 완료를 취소하고 당시 차감한 재료를 재고에 복구할까요?')) return
    update(undoRecipeCompletion(data, ship.id, recipeId))
    setNotice('제작 완료를 취소하고 재료를 공유 재고에 복구했습니다.')
  }
  const setSupplyPlan = (task: DailyTask, patch: { enabled?: boolean; choiceId?: string }) =>
    update({
      ...data,
      supplyPlans: {
        ...data.supplyPlans,
        [task.id]: { ...data.supplyPlans[task.id], ...patch },
      },
    })
  const chooseRoute = (route: QuestRoute, optionId: string) => {
    const selectedOption = route.options.find((option) => option.id === optionId)
    if (!selectedOption) return
    const routeQuestIds = route.options.flatMap((option) => option.questIds)
    const supplyPlans = { ...data.supplyPlans }
    supplyPlans[`route:${route.id}`] = { enabled: true, choiceId: optionId }
    routeQuestIds.forEach((questId) => {
      supplyPlans[questId] = {
        ...supplyPlans[questId],
        enabled: false,
      }
    })
    update({ ...data, supplyPlans })
  }
  const addManual = (materialId: string) => {
    const amount = clamp(Number(manualAdds[materialId]))
    if (!amount) {
      setNotice('추가할 수량을 1 이상 입력하세요.')
      return
    }
    setOwned(materialId, clamp(data.inventory[materialId]) + amount)
    setManualAdds({ ...manualAdds, [materialId]: '' })
    setNotice(`${materialById[materialId].name} ${number(amount)}개를 추가했습니다.`)
  }
  const setMaterialSort = (key: MaterialSortKey) =>
    update({
      ...data,
      materialSort: {
        key,
        direction:
          data.materialSort.key === key && data.materialSort.direction === 'desc' ? 'asc' : 'desc',
      },
    })
  const setMaterialExchangeSort = (key: MaterialExchangeSortKey) =>
    update({
      ...data,
      materialExchangeSort: {
        key,
        direction:
          data.materialExchangeSort.key === key && data.materialExchangeSort.direction === 'desc'
            ? 'asc'
            : 'desc',
      },
    })
  const updateBarterSession = (patch: Partial<AppData['barterSession']>) =>
    update({ ...data, barterSession: { ...data.barterSession, ...patch } })
  useEffect(() => {
    if (!barterToast) return
    let remaining = 4000
    let started = 0
    let timer: number | undefined
    const pauseOrResume = () => {
      if (document.visibilityState === 'hidden') {
        if (timer) window.clearTimeout(timer)
        remaining -= Date.now() - started
      } else {
        started = Date.now()
        timer = window.setTimeout(() => setBarterToast(null), Math.max(0, remaining))
      }
    }
    pauseOrResume()
    document.addEventListener('visibilitychange', pauseOrResume)
    return () => {
      if (timer) window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', pauseOrResume)
    }
  }, [barterToast])
  const addBarterListing = (row: BarterRow) => {
    const session = data.barterSession
    const exchangeCounts = {
      ...session.exchangeCounts,
      [row.exchangeKey]: (session.exchangeCounts[row.exchangeKey] || 0) + 1,
    }
    update({ ...data, barterSession: { ...session, exchangeCounts } })
    setBarterFlashId(row.exchangeKey)
    window.setTimeout(
      () => setBarterFlashId((current) => (current === row.exchangeKey ? null : current)),
      420,
    )
  }
  const removeBarterListing = (row: BarterRow) => {
    const session = data.barterSession
    const count = session.exchangeCounts[row.exchangeKey] || 0
    if (!count) return
    const exchangeCounts = { ...session.exchangeCounts, [row.exchangeKey]: count - 1 }
    update({ ...data, barterSession: { ...session, exchangeCounts } })
    setBarterFlashId(row.exchangeKey)
    window.setTimeout(
      () => setBarterFlashId((current) => (current === row.exchangeKey ? null : current)),
      420,
    )
  }
  const completeBarter = (row: BarterRow) => {
    const session = data.barterSession
    const count = session.exchangeCounts[row.exchangeKey] || 0
    if (!count) return
    const exchangeCounts = { ...session.exchangeCounts, [row.exchangeKey]: count - 1 }
    const inventory = session.addToInventory
      ? { ...data.inventory, [row.id]: clamp(data.inventory[row.id]) + row.outputQuantity }
      : data.inventory
    update({ ...data, inventory, barterSession: { ...session, exchangeCounts } })
    if (session.addToInventory)
      setBarterToast((previous) =>
        previous?.materialId === row.id
          ? { ...previous, id: id(), quantity: previous.quantity + row.outputQuantity }
          : { id: id(), materialId: row.id, quantity: row.outputQuantity },
      )
  }
  const editShip = (ship: Ship) =>
    update({
      ...data,
      ships: data.ships.map((x) => (x.id === ship.id ? ship : x)),
    })
  const removeShip = (ship: Ship) => {
    if (!confirm(`${ship.name}을 함대에서 제거할까요?`)) return
    const ships = data.ships.filter((x) => x.id !== ship.id)
    update({ ...data, ships })
    setSelected(ships[0]?.id || '')
  }
  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `bdo-fleet-profile-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const importData = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    try {
      update(normalize(JSON.parse(await f.text())))
      setNotice('진행 데이터를 가져왔습니다.')
    } catch (err) {
      setNotice(err instanceof Error ? err.message : '가져오기 실패')
    } finally {
      e.target.value = ''
    }
  }
  return (
    <main>
      <header>
        <div className="brand">
          <img
            src={`${import.meta.env.BASE_URL}ship-growth-logo.png`}
            alt="함선 성장 재료 관리 로고"
          />
          <div>
            <p className="eyebrow">BLACK DESERT · FLEET PROGRESSION</p>
            <h1>함선 성장 재료 관리</h1>
          </div>
        </div>
        <div className="header-status">
          <button
            className={`drive-status ${drive.status}`}
            onClick={
              drive.status === 'disconnected' || drive.status === 'failed'
                ? drive.hasRememberedConnection
                  ? drive.reauthorize
                  : drive.authorize
                : undefined
            }
          >
            {drive.status === 'disconnected'
              ? drive.hasRememberedConnection
                ? '● 동기화 대기'
                : 'Google Drive 연결'
              : drive.status === 'connecting'
                ? 'Drive 연결 중…'
                : drive.status === 'synced'
                  ? '● 동기화됨'
                  : '● 동기화 실패'}
          </button>
          <span className="save">
            {drive.lastSavedAt
              ? `Drive 저장 ${new Date(drive.lastSavedAt).toLocaleString('ko-KR')}`
              : notice || 'LocalStorage 자동 저장'}
          </span>
        </div>
      </header>
      <nav>
        {(
          [
            ['dashboard', '함대 현황'],
            ['ship', '선박 단계'],
            ['materials', '전체 재료'],
            ['barter', '물물교환'],
            ['daily', '일일 수급'],
            ['guide', '수급 도감'],
            ['settings', '함대·백업'],
          ] as [AppTab, string][]
        ).map(([k, l]) => (
          <button className={tab === k ? 'active' : ''} onClick={() => setTab(k)} key={k}>
            {l}
          </button>
        ))}
      </nav>
      {tab === 'dashboard' && (
        <section>
          <div className="hero">
            <div>
              <p>추적 중인 함선</p>
              <strong>{data.ships.length}</strong>
              <span className="hero-copy">척 · 공유 재고 기준</span>
            </div>
            <div className="stat">
              <b>{totals.filter((x) => x.shortage > 0).length}</b>
              <span>개 재료 부족</span>
            </div>
            <div className="stat">
              <b>{number(totalCrow)}</b>
              <span>까마귀 주화 필요 (단가 확인분)</span>
            </div>
          </div>
          <h2>내 함대</h2>
          <div className="cards">
            {data.ships.map((ship) => {
              const p = stageProgress(data, ship)
              return (
                <button
                  className="card"
                  onClick={() => {
                    setSelected(ship.id)
                    setTab('ship')
                  }}
                  key={ship.id}
                >
                  <span>
                    {hullLabel[ship.hull]} · {stageLabel[ship.activeStage]}
                  </span>
                  <h3>{ship.name}</h3>
                  <Progress value={p} />
                  <small>{p === 100 ? '현재 단계 준비 완료' : '현재 단계 재료 준비 중'}</small>
                </button>
              )
            })}
            {!data.ships.length && <p className="empty">함대·백업 탭에서 선박을 추가하세요.</p>}
          </div>
          <h2>가장 부족한 재료</h2>
          <div className="top-list">
            {aggregate(data, fleetDemandScope('current'))
              .filter((x) => x.shortage)
              .sort((a, b) => b.shortage - a.shortage)
              .slice(0, 5)
              .map((x) => (
                <div key={x.id}>
                  <b>{x.name}</b>
                  <span>
                    필요 {number(x.required)} · 보유 {number(x.owned)} ·{' '}
                    <em>부족 {number(x.shortage)}</em>
                  </span>
                </div>
              ))}
          </div>
          <div className="section-title barter-summary-title">
            <div>
              <p>물교 1회로 까주 구매를 가장 많이 대체하는 부족 재료</p>
              <h2>이번 물교 추천</h2>
            </div>
            <button
              onClick={() => {
                setTab('barter')
              }}
            >
              전체 보기
            </button>
          </div>
          <div className="top-list barter-top-list">
            {sortBarterRows(barterRows, 'priority', 'desc')
              .slice(0, 3)
              .map((row) => (
                <div key={row.id}>
                  <b>
                    {row.name} <small>1 : {number(row.outputQuantity)}</small>
                  </b>
                  <span>
                    {row.exchangeCrowValue === undefined
                      ? '까주 단가 미확인'
                      : `물교 1회 = ${number(row.exchangeCrowValue)} 주화 상당`}{' '}
                    · 부족 {number(row.shortage)}
                  </span>
                </div>
              ))}
            {!barterRows.length && <p className="empty">현재 범위에 부족한 재료가 없습니다.</p>}
          </div>
        </section>
      )}
      {tab === 'ship' && (
        <section>
          {
            <div className="equip-tabs">
              {data.ships.map((ship) => (
                <button
                  key={ship.id}
                  className={ship.id === selected ? 'active' : ''}
                  onClick={() => setSelected(ship.id)}
                >
                  {ship.name}
                </button>
              ))}
            </div>
          }
          {currentShip ? (
            <>
              <div className="section-title">
                <div>
                  <p>
                    {hullLabel[currentShip.hull]} · {stageLabel[currentShip.activeStage]}
                  </p>
                  <h2>{currentShip.name}</h2>
                </div>
                <Progress value={stageProgress(data, currentShip)} />
              </div>
              <div className="stepper">
                {([1, 2, 3, 4] as Stage[]).map((s) => (
                  <button
                    key={s}
                    className={
                      s === currentShip.activeStage
                        ? 'active'
                        : s < currentShip.activeStage
                          ? 'past'
                          : ''
                    }
                    onClick={() => editShip({ ...currentShip, activeStage: s })}
                  >
                    <b>{s}</b>
                    {stageLabel[s]}
                  </button>
                ))}
              </div>
              {(currentShip.hull === 'trade' || currentShip.hull === 'warship') && (
                <label className="upgrade-choice">
                  중범선 증축 목표
                  <select
                    value={currentShip.upgradeHull || defaultUpgradeHull[currentShip.hull]}
                    onChange={(e) =>
                      editShip({
                        ...currentShip,
                        upgradeHull: e.target.value as Ship['upgradeHull'],
                      })
                    }
                  >
                    {upgradeTargets[currentShip.hull].map((hull) => (
                      <option key={hull} value={hull}>
                        {hullLabel[hull]}
                      </option>
                    ))}
                  </select>
                  <small>
                    2단계에서 에페리아 함선 장비와 선택한 중범선 증축 재료를 함께 집계합니다.
                  </small>
                </label>
              )}
              <p className="muted">
                단계를 클릭하면 해당 단계의 고정 제작식만 봅니다. 재료 보유량은 함대 전체에서
                공유됩니다.
              </p>
              {pendingRecipes.map((recipe, index) => {
                const materialsReady = canCompleteRecipe(data.inventory, recipe)
                const prerequisiteCount = recipe.prerequisiteRecipeIds?.length ?? 0
                const completedPrerequisiteCount =
                  recipe.prerequisiteRecipeIds?.filter((recipeId) =>
                    isRecipeCompleted(data, currentShip.id, recipeId),
                  ).length ?? 0
                const canCraft = canCompleteRecipeForShip(data, currentShip.id, recipe)
                return (
                  <article className="recipe" key={recipe.id}>
                    <div>
                      <p>진행률 {recipeProgress(recipe, data.inventory)}%</p>
                      <h3>{recipe.name}</h3>
                      <small>{recipe.description}</small>
                      {prerequisiteCount > 0 && (
                        <small className="recipe-prerequisite">
                          선행 제작 · 에페리아 함선 장비 {completedPrerequisiteCount}/
                          {prerequisiteCount}종 완료
                        </small>
                      )}
                    </div>
                    {recipe.slot && (
                      <span className="order-actions">
                        <button
                          disabled={index === 0}
                          onClick={() => {
                            const order = [...currentShip.equipmentOrder]
                            const position = order.indexOf(recipe.slot!)
                            ;[order[position - 1], order[position]] = [
                              order[position],
                              order[position - 1],
                            ]
                            editShip({ ...currentShip, equipmentOrder: order })
                          }}
                        >
                          ↑
                        </button>
                        <button
                          disabled={index === pendingRecipes.length - 1}
                          onClick={() => {
                            const order = [...currentShip.equipmentOrder]
                            const position = order.indexOf(recipe.slot!)
                            ;[order[position + 1], order[position]] = [
                              order[position],
                              order[position + 1],
                            ]
                            editShip({ ...currentShip, equipmentOrder: order })
                          }}
                        >
                          ↓
                        </button>
                      </span>
                    )}
                    <Progress value={recipeProgress(recipe, data.inventory)} />
                    <div className="craft-action">
                      <small>
                        {!canCraft
                          ? '선행 에페리아 함선 장비 제작을 모두 완료하면 증축할 수 있습니다.'
                          : materialsReady
                            ? '재료가 모두 준비되었습니다. 제작 완료 시 공유 재고에서 차감합니다.'
                            : '부족해도 완료 처리할 수 있으며, 요구 수량만큼 차감 처리합니다. 재고는 최소 0개입니다.'}
                      </small>
                      <button
                        className="primary"
                        disabled={!canCraft}
                        onClick={() =>
                          setCraftConfirm({ shipId: currentShip.id, recipeId: recipe.id })
                        }
                      >
                        제작 완료
                      </button>
                    </div>
                    <RecipeRows
                      recipe={recipe}
                      inventory={data.inventory}
                      setOwned={setOwned}
                      showSource={setSource}
                      data={data}
                      showSupply={setSupplyDetail}
                    />
                  </article>
                )
              })}
              {completedCurrentRecipes.length > 0 && (
                <details className="completed-recipes" open>
                  <summary>완료한 제작 · {number(completedCurrentRecipes.length)}개</summary>
                  {completedCurrentRecipes.map((recipe) => {
                    const record = data.completedRecipes[craftRecordKey(currentShip.id, recipe.id)]
                    return (
                      <article className="recipe completed-recipe" key={recipe.id}>
                        <div>
                          <p>
                            제작 완료 · {new Date(record.completedAt).toLocaleDateString('ko-KR')}
                          </p>
                          <h3>{recipe.name}</h3>
                          <small>
                            {Object.entries(record.consumedMaterials)
                              .map(
                                ([materialId, quantity]) =>
                                  `${materialById[materialId]?.name || materialId} ${number(quantity)}개`,
                              )
                              .join(' · ')}
                          </small>
                        </div>
                        <div className="completed-recipe-actions">
                          <span className="completed-status">완료</span>
                          <button
                            className="craft-undo"
                            onClick={() => undoCraft(currentShip, recipe.id)}
                          >
                            제작 완료 취소 · 재료 복구
                          </button>
                        </div>
                      </article>
                    )
                  })}
                </details>
              )}
            </>
          ) : (
            <p className="empty">선박을 선택하거나 함대를 추가하세요.</p>
          )}
        </section>
      )}
      {(tab === 'materials' || tab === 'barter') && (
        <section>
          <div className="section-title material-page-title">
            <div>
              <p>
                {tab === 'materials'
                  ? '함대 목표에 필요한 공유 재고와 부족분을 관리합니다.'
                  : '이번 재료 갱신에서 거래할 부족 재료를 정합니다.'}
              </p>
              <h2>{tab === 'materials' ? '전체 재료 현황' : '물교 우선순위'}</h2>
            </div>
          </div>
          <div className="toolbar">
            <button
              className={scope.target === 'fleet' && scope.range === 'all' ? 'primary' : ''}
              onClick={() => setScope(fleetDemandScope('all'))}
            >
              함대 전체 목표
            </button>
            <button
              className={scope.target === 'fleet' && scope.range === 'current' ? 'primary' : ''}
              onClick={() => setScope(fleetDemandScope('current'))}
            >
              함대 현재 단계
            </button>
            {currentShip && (
              <>
                <button
                  className={
                    scope.target === 'ship' &&
                    scope.shipId === currentShip.id &&
                    scope.range === 'all'
                      ? 'primary'
                      : ''
                  }
                  onClick={() => setScope(shipDemandScope(currentShip.id, 'all'))}
                >
                  {currentShip.name} 전체 목표
                </button>
                <button
                  className={
                    scope.target === 'ship' &&
                    scope.shipId === currentShip.id &&
                    scope.range === 'current'
                      ? 'primary'
                      : ''
                  }
                  onClick={() => setScope(shipDemandScope(currentShip.id, 'current'))}
                >
                  {currentShip.name} 현재 단계
                </button>
              </>
            )}
            {tab === 'materials' && (
              <input
                placeholder="재료명 검색"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            )}
            <span className="save">
              대상: {demandScopeLabel(data, scope)} ·{' '}
              {tab === 'materials'
                ? `정렬: ${data.materialSort.key} ${data.materialSort.direction === 'asc' ? '↑' : '↓'}`
                : '물교 1회 절감 까주 우선'}{' '}
              · 단가 확인 {priced}/{totals.length}종 · 부족분 {number(totalCrow)} 주화
            </span>
          </div>
          {tab === 'materials' ? (
            <MaterialTable
              rows={orderedTotals.filter((x) => x.name.includes(query))}
              setOwned={setOwned}
              showSource={setSource}
              showSupply={setSupplyDetail}
              sort={data.materialSort}
              onSort={setMaterialSort}
            />
          ) : (
            <>
              <BarterSessionControls
                session={data.barterSession}
                onChange={updateBarterSession}
                onReset={() => {
                  if (confirm('이번 갱신 목록을 초기화할까요? 재고는 바뀌지 않습니다.'))
                    updateBarterSession({ exchangeCounts: {} })
                }}
              />
              <BarterPriorityTable
                rows={orderedBarterRows}
                sort={data.materialExchangeSort}
                onSort={setMaterialExchangeSort}
                showSource={setSource}
                session={data.barterSession}
                flashId={barterFlashId}
                onAdd={addBarterListing}
                onRemove={removeBarterListing}
                onComplete={completeBarter}
              />
            </>
          )}
        </section>
      )}
      {tab === 'daily' && (
        <section>
          <div className="section-title">
            <div>
              <p>활성화한 의뢰만 재료별 수급 예상에 반영합니다</p>
              <h2>내 일일·주간 수급 계획</h2>
            </div>
            <span className="save">
              재고는 변경하지 않습니다 · 선택 보상은 계획한 보상만 계산합니다
            </span>
          </div>
          <div className="location-quest-list">
            {locations.map((location) => {
              const locationTasks = dailyTasks.filter(
                (task) => task.startLocationId === location.id,
              )
              if (!locationTasks.length) return null
              const locationRoutes = questRoutes.filter(
                (route) => route.startLocationId === location.id,
              )
              const routedQuestIds = new Set(
                locationRoutes.flatMap((route) =>
                  route.options.flatMap((option) => option.questIds),
                ),
              )
              const giverIds = [...new Set(locationTasks.map((task) => task.giverId || 'unknown'))]
              return (
                <details className="location-quests" key={location.id} open>
                  <summary>
                    <span>{locationById[location.id].name}</span>
                    <small>Codex 확인 의뢰 {locationTasks.length}개</small>
                  </summary>
                  {giverIds.map((giverId) => {
                    const giverTasks = locationTasks.filter(
                      (task) => (task.giverId || 'unknown') === giverId,
                    )
                    const giverRoutes = locationRoutes.filter(
                      (route) => (route.giverId || 'unknown') === giverId,
                    )
                    const standalone = giverTasks.filter((task) => !routedQuestIds.has(task.id))
                    return (
                      <div className="giver-group" key={giverId}>
                        <h3>
                          {npcById[giverId]?.codexNpcId ? (
                            <a
                              href={codexNpcUrl(npcById[giverId].codexNpcId!)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {npcById[giverId].name}
                            </a>
                          ) : (
                            npcById[giverId]?.name || '수령 NPC 확인 필요'
                          )}
                          <small> 의뢰 수령 NPC · BDO Codex</small>
                        </h3>
                        {giverRoutes.map((route) => {
                          const routePlan = data.supplyPlans[`route:${route.id}`]
                          const selectedOption = route.options.find((option) =>
                            routePlan?.choiceId
                              ? option.id === routePlan.choiceId
                              : option.questIds.some(
                                  (questId) => data.supplyPlans[questId]?.enabled,
                                ),
                          )
                          return (
                            <div className="route-picker" key={route.id} data-route-id={route.id}>
                              <div>
                                <b>{route.name}</b>
                                <p>{route.description}</p>
                              </div>
                              <div className="route-options">
                                {route.options.map((option) => (
                                  <button
                                    key={option.id}
                                    className={selectedOption?.id === option.id ? 'primary' : ''}
                                    onClick={() => chooseRoute(route, option.id)}
                                  >
                                    {option.label}
                                  </button>
                                ))}
                              </div>
                              {selectedOption && (
                                <div className="task-grid route-task-grid">
                                  {selectedOption.questIds.map((questId) => {
                                    const task = dailyTasks.find((item) => item.id === questId)
                                    return task ? (
                                      <QuestPlanCard
                                        key={task.id}
                                        task={task}
                                        plan={data.supplyPlans[task.id]}
                                        onPlan={setSupplyPlan}
                                        routeManaged
                                      />
                                    ) : null
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })}
                        {!!standalone.length && (
                          <div className="task-grid">
                            {standalone.map((task) => (
                              <QuestPlanCard
                                key={task.id}
                                task={task}
                                plan={data.supplyPlans[task.id]}
                                onPlan={setSupplyPlan}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </details>
              )
            })}
          </div>
          <div className="section-title manual-title">
            <div>
              <p>의뢰 보상과 별도로, 현재 보유량에 더합니다</p>
              <h2>재료 단위 수동 추가</h2>
            </div>
          </div>
          <div className="manual-grid">
            {materials.map((item) => {
              const total = allTotals.find((x) => x.id === item.id)
              const owned = clamp(data.inventory[item.id])
              return (
                <div className="manual-row" key={item.id}>
                  <b>{item.name}</b>
                  <span>
                    보유 {number(owned)} · 부족 {number(total?.shortage || 0)}
                  </span>
                  <input
                    className="num"
                    type="number"
                    min="0"
                    placeholder="추가 수량"
                    value={manualAdds[item.id] || ''}
                    onChange={(e) =>
                      setManualAdds({
                        ...manualAdds,
                        [item.id]: e.target.value,
                      })
                    }
                  />
                  <button onClick={() => addManual(item.id)}>+ 추가</button>
                </div>
              )
            })}
          </div>
        </section>
      )}
      {tab === 'guide' && (
        <GuidePage materials={materials} query={query} onQueryChange={setQuery} />
      )}
      {tab === 'settings' && (
        <SettingsPage
          data={data}
          drive={drive}
          importRef={importRef}
          onEditShip={editShip}
          onRemoveShip={removeShip}
          onAddShip={(hull) => {
            const ship = newShip(hull)
            update({ ...data, ships: [...data.ships, ship] })
            setSelected(ship.id)
          }}
          onExport={exportData}
          onImport={importData}
          onRestoreSample={() => update(freshSample())}
          onClear={() => {
            if (confirm('현재 브라우저 진행 데이터를 초기화할까요?')) {
              clearData()
              update(freshSample())
            }
          }}
        />
      )}
      {craftConfirm &&
        (() => {
          const ship = data.ships.find((item) => item.id === craftConfirm.shipId)
          const recipe = ship && shipRecipes(ship).find((item) => item.id === craftConfirm.recipeId)
          if (!ship || !recipe) return null
          return (
            <div className="modal">
              <div className="craft-confirm">
                <h2>{recipe.name} 제작 완료</h2>
                <p>
                  요구 수량 전체를 함대 공유 재고에서 차감 처리합니다. 재고는 0개 아래로 내려가지
                  않으며, 완료 후 전체 재료·물교 우선순위도 즉시 다시 계산됩니다.
                </p>
                <ul>
                  {recipe.requirements.map((requirement) => (
                    <li key={requirement.materialId}>
                      <b>{materialById[requirement.materialId].name}</b>
                      <span>
                        필요 {number(requirement.quantity)}개 · 보유{' '}
                        {number(clamp(data.inventory[requirement.materialId]))}개 → {''}
                        {number(requirement.quantity)}개 차감 처리 · 남음{' '}
                        {number(
                          Math.max(
                            clamp(data.inventory[requirement.materialId]) - requirement.quantity,
                            0,
                          ),
                        )}
                        개
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="modal-actions">
                  <button onClick={() => setCraftConfirm(null)}>취소</button>
                  <button className="primary" onClick={completeCraft}>
                    요구 재료 차감 후 완료
                  </button>
                </div>
              </div>
            </div>
          )
        })()}
      {source && (
        <div className="modal">
          <div>
            <h2>{materialById[source].name} · 획득처</h2>
            <p>
              까마귀 주화 단가:{' '}
              {materialById[source].crowCoinPrice === undefined
                ? '확인 필요'
                : `${number(materialById[source].crowCoinPrice!)}개 / 1개`}
            </p>
            <ul>
              {materialById[source].sources.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <div className="modal-actions">
              <button onClick={() => setSource(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}
      {supplyDetail &&
        (() => {
          const material = materialById[supplyDetail.materialId]
          const supply = materialSupply(data, material.id)
          const sources =
            supplyDetail.period === 'daily' ? supply.dailySources : supply.weeklySources
          const total = supplyDetail.period === 'daily' ? supply.daily : supply.weekly
          return (
            <div className="modal">
              <div>
                <h2>
                  {material.name} · {supplyDetail.period === 'daily' ? '일일' : '주간'} 수급
                </h2>
                <p>
                  현재 수급 계획 합계:{' '}
                  <b>
                    {number(total)}개 / {supplyDetail.period === 'daily' ? '일' : '주'}
                  </b>
                </p>
                {sources.length ? (
                  <ul className="supply-source-list">
                    {sources.map((entry) => (
                      <li key={entry.taskId}>
                        <b>{entry.taskName}</b>
                        <span>
                          +{number(entry.quantity)}개 / {entry.period === 'daily' ? '일' : '주'}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>
                    수급 예정으로 설정한 {supplyDetail.period === 'daily' ? '일일' : '주간'} 의뢰가
                    없습니다.
                  </p>
                )}
                <div className="modal-actions">
                  <button onClick={() => setSupplyDetail(null)}>닫기</button>
                </div>
              </div>
            </div>
          )
        })()}
      {drive.conflict && (
        <div className="modal">
          <div>
            <h2>Drive와 로컬 데이터가 다릅니다</h2>
            <p>
              더 최신인 쪽: <b>{drive.conflict.newer === 'drive' ? 'Drive' : '로컬'}</b>. 선택한
              데이터가 반대쪽을 덮어씁니다.
            </p>
            <div className="modal-actions">
              <button onClick={() => drive.resolveConflict('drive')}>Drive 사용</button>
              <button className="primary" onClick={() => drive.resolveConflict('local')}>
                로컬 사용
              </button>
            </div>
          </div>
        </div>
      )}
      {barterToast && (
        <div className="barter-toast" role="status">
          {materialById[barterToast.materialId].name} 재고 {number(barterToast.quantity)}개 추가됨
        </div>
      )}
    </main>
  )
}
