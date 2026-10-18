import type { Dispatch, SetStateAction } from 'react'
import type { AggregateMaterial, AppData, DailyTask, QuestRoute } from '../types'
import { dailyTasks, materials } from '../catalog'
import { clamp, number } from '../utils'
import { locationById, locations } from '../data/locations'
import { npcById } from '../data/npcs'
import { questRoutes } from '../data/questRoutes'
import { codexNpcUrl } from '../data/codex'
import { QuestPlanCard } from './QuestPlanCard'
interface Props {
  data: AppData
  allTotals: AggregateMaterial[]
  manualAdds: Record<string, string>
  setManualAdds: Dispatch<SetStateAction<Record<string, string>>>
  addManual: (id: string) => void
  chooseRoute: (route: QuestRoute, optionId: string) => void
  setSupplyPlan: (task: DailyTask, patch: { enabled?: boolean; choiceId?: string }) => void
}
export function SupplyPlanPage({
  data,
  allTotals,
  manualAdds,
  setManualAdds,
  addManual,
  chooseRoute,
  setSupplyPlan,
}: Props) {
  return (
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
          const locationTasks = dailyTasks.filter((task) => task.startLocationId === location.id)
          if (!locationTasks.length) return null
          const locationRoutes = questRoutes.filter(
            (route) => route.startLocationId === location.id,
          )
          const routedQuestIds = new Set(
            locationRoutes.flatMap((route) => route.options.flatMap((option) => option.questIds)),
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
                          : option.questIds.some((questId) => data.supplyPlans[questId]?.enabled),
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
  )
}
