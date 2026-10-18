import type { AppData } from '../types'
import { hullLabel, materialById } from '../catalog'
import { clamp, number, shipRecipes, materialSupply } from '../utils'
import { CraftingTree } from '../features/CraftingTree'

type CraftSelection = { shipId: string; recipeId: string; method: 'crafted' | 'purchased' }
type SupplySelection = { materialId: string; period: 'daily' | 'weekly' }
interface Props {
  data: AppData
  craftConfirm: CraftSelection | null
  source: string | null
  supplyDetail: SupplySelection | null
  setCraftConfirm: (value: null) => void
  setSource: (value: null) => void
  setSupplyDetail: (value: null) => void
  completeCraft: () => void
}
export function ShipDialogs({
  data,
  craftConfirm,
  source,
  supplyDetail,
  setCraftConfirm,
  setSource,
  setSupplyDetail,
  completeCraft,
}: Props) {
  return (
    <>
      {' '}
      {craftConfirm &&
        (() => {
          const ship = data.ships.find((item) => item.id === craftConfirm.shipId)
          const recipe = ship && shipRecipes(ship).find((item) => item.id === craftConfirm.recipeId)
          if (!ship || !recipe) return null
          return (
            <div className="modal">
              <div className="craft-confirm">
                <h2>
                  {recipe.name} {craftConfirm.method === 'purchased' ? '구매 처리' : '제작 완료'}
                </h2>
                <p>
                  {craftConfirm.method === 'purchased'
                    ? '장비를 구매하거나 외부에서 확보한 것으로 완료 처리합니다. 공유 재료 재고와 제작 결과 재고는 변경하지 않으며, 완료 후 재료 수요와 물교 우선순위만 다시 계산됩니다.'
                    : '요구 수량 전체를 함대 공유 재고에서 차감 처리합니다. 재고는 0개 아래로 내려가지 않으며, 완료 후 전체 재료·물교 우선순위도 즉시 다시 계산됩니다.'}
                </p>
                {recipe.resultHull && (
                  <p className="craft-result">
                    증축 결과 · 완료 즉시 이 선박은 <b>{hullLabel[recipe.resultHull]}</b>으로
                    전환됩니다. 완료 취소 시에는 이전 선박 종류와 재료를 함께 복구합니다.
                  </p>
                )}
                {craftConfirm.method === 'crafted' && (
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
                )}
                {craftConfirm.method === 'crafted' && recipe.produces?.length ? (
                  <p className="craft-result">
                    제작 결과 ·{' '}
                    {recipe.produces
                      .map(
                        (product) =>
                          `${materialById[product.materialId].name} ${number(product.quantity)}개`,
                      )
                      .join(' · ')}{' '}
                    재고에 추가
                  </p>
                ) : null}
                <div className="modal-actions">
                  <button onClick={() => setCraftConfirm(null)}>취소</button>
                  <button className="primary" onClick={completeCraft}>
                    {craftConfirm.method === 'purchased'
                      ? '재료 유지 후 구매 완료'
                      : '요구 재료 차감 후 완료'}
                  </button>
                </div>
              </div>
            </div>
          )
        })()}
      {source &&
        (() => {
          const material = materialById[source]
          return (
            <div className="modal">
              <div>
                <h2>{material.name} · 획득처</h2>
                {material.crowCoinPrice !== undefined ? (
                  <p>까마귀 주화 단가: {number(material.crowCoinPrice)}개 / 1개</p>
                ) : null}
                {material.processingRecipes?.length ? (
                  <section className="acquisition-detail" aria-label="제작 노트 가공식">
                    <h3>제작 노트 가공식</h3>
                    {material.processingRecipes.map((recipe) => (
                      <div key={recipe.method} className="processing-recipe">
                        <b>{recipe.method}</b>
                        <p>
                          {recipe.ingredients
                            .map(
                              (ingredient) => `${ingredient.name} ${number(ingredient.quantity)}개`,
                            )
                            .join(' + ')}
                        </p>
                        {recipe.result ? <small>제작 결과 · {recipe.result}</small> : null}
                        {recipe.knowledge ? <small>필요 지식 · {recipe.knowledge}</small> : null}
                        {recipe.note ? <small>{recipe.note}</small> : null}
                      </div>
                    ))}
                  </section>
                ) : null}
                <CraftingTree materialId={material.id} />
                <section className="acquisition-detail" aria-label="기타 획득처">
                  <h3>기타 획득처</h3>
                  <ul>
                    {material.sources.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </section>
                <div className="modal-actions">
                  {material.codexItemId ? (
                    <a
                      className="button-link"
                      href={`https://bdocodex.com/kr/item/${material.codexItemId}/?sl=1`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      BDO Codex 상세
                    </a>
                  ) : null}
                  <button onClick={() => setSource(null)}>닫기</button>
                </div>
              </div>
            </div>
          )
        })()}
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
    </>
  )
}
