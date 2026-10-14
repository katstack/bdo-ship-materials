import { useEffect, useMemo, useState } from 'react'
import { getAcquisitions } from '../crafting/acquisition'
import { loadNpcs } from '../crafting/catalogClient'
import type { ItemDetail, SourceNpc } from '../crafting/types'

const labels = {
  'npc-purchase': 'NPC 구매',
  'crow-coin': '까마귀 주화 구매',
  barter: '물물교환 · 재료 교환',
  rental: 'NPC 대여',
  crafting: '제작 · 가공',
  gathering: '채집',
}
const evidenceLabels = {
  'client-item-info': '클라이언트 아이템 안내문',
  'client-dialogue': '클라이언트 NPC 대화',
  'official-update': '한국 공식 업데이트 가격표',
  'app-catalog': '앱 교환비 카탈로그 · 사용자 확인',
}
const number = (value: number) => value.toLocaleString('ko-KR')

export function AcquisitionMethods({ detail }: { detail: ItemDetail }) {
  const [npcs, setNpcs] = useState<SourceNpc[]>([])
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [retry, setRetry] = useState(0)
  const needsNpcs = !!(detail.item.vendors?.urns?.length || detail.item.rentalOffers?.length)
  useEffect(() => {
    if (!needsNpcs) return
    let active = true
    loadNpcs()
      .then((value) => {
        if (active) {
          setNpcs(value)
          setLoaded(true)
          setError('')
        }
      })
      .catch((e: unknown) => {
        if (active) {
          setLoaded(true)
          setError(e instanceof Error ? e.message : 'NPC 정보 불러오기 실패')
        }
      })
    return () => {
      active = false
    }
  }, [needsNpcs, retry])
  const npcMap = useMemo(() => new Map(npcs.map((npc) => [String(npc.id), npc])), [npcs])
  const methods = getAcquisitions(detail, npcMap)
  return (
    <section className="acquisition-methods" aria-label="아이템 획득 방법">
      <h3>획득 방법</h3>
      {!methods.length && (
        <p className="save">
          확인된 획득 방법이 없습니다. 기본 가격값만으로 구매 가능 여부를 판단하지 않습니다.
        </p>
      )}
      {needsNpcs && !loaded && <p className="save">판매 NPC 정보 불러오는 중…</p>}
      {error && (
        <p role="alert">
          {error} <button onClick={() => setRetry((value) => value + 1)}>다시 시도</button>
        </p>
      )}
      <div className="acquisition-list">
        {methods.map((method, index) => (
          <div className="acquisition-card" key={`${method.kind}-${index}`}>
            <h4>{labels[method.kind]}</h4>
            {method.unitPrice !== undefined && <p>1개당 {number(method.unitPrice)} 까마귀 주화</p>}
            {method.referencePrice !== undefined && (
              <p>
                아이템 기본 가격값: {number(method.referencePrice)}{' '}
                <small>· 실제 상점 가격·통화 미확인</small>
              </p>
            )}
            {method.kind === 'npc-purchase' && (
              <p className="save">
                안내문에 기재된 판매처입니다. 상점별 판매 조건·재고·가격은 별도 확인이 필요합니다.
              </p>
            )}
            {method.outputQuantities && (
              <p>
                교역품 1개 → {method.outputQuantities.map(number).join(' 또는 ')}개
                {method.outputQuantities.length > 1 ? ' · 갱신별 변동' : ''}
              </p>
            )}
            {method.kind === 'barter' && (
              <p className="save">요구 교역품·교환 장소는 현재 갱신 목록에서 확인하세요.</p>
            )}
            {method.kind === 'crafting' && (
              <p>제작식 {number(method.count ?? 0)}개 · 아래 제작식에서 재료 확인</p>
            )}
            {method.kind === 'rental' && (
              <p>
                {method.pointType === 5 ? '공헌도' : `포인트 유형 ${method.pointType ?? '미확인'}`}{' '}
                {method.pointCost === undefined ? '비용 미확인' : number(method.pointCost)}
                {method.count !== undefined ? ` · ${number(method.count)}개 대여` : ''}
              </p>
            )}
            {method.sources && (
              <p>
                {method.sources.join(', ')} <small>· 원문 명칭</small>
              </p>
            )}
            {method.vendors && (
              <details className="acquisition-vendors" open={method.vendors.length <= 3}>
                <summary>판매·대여 NPC {number(method.vendors.length)}곳</summary>
                <ul>
                  {method.vendors.map((npc, position) => (
                    <li key={`${npc.id ?? npc.name}-${position}`}>
                      {npc.id ? (
                        <a
                          href={`https://bdocodex.com/kr/npc/${npc.id}/`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {npc.name}
                        </a>
                      ) : (
                        npc.name
                      )}
                      {npc.id && <small> · ID {npc.id}</small>}
                      <div className="save">
                        {npc.regions.length ? npc.regions.join(' / ') : '지역 미확보'} ·{' '}
                        {npc.resolved ? '해외 클라이언트 명칭' : 'NPC 상세 미확보'}
                      </div>
                      {npc.condition && (
                        <details>
                          <summary>상점 접근 조건 원문</summary>
                          <code>{npc.condition}</code>
                        </details>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {method.condition && (
              <details>
                <summary>대여 조건 원문</summary>
                <code>{method.condition}</code>
              </details>
            )}
            <small className="save">
              출처:{' '}
              {method.sourceUrl ? (
                <a href={method.sourceUrl} target="_blank" rel="noreferrer">
                  {evidenceLabels[method.evidence]}
                </a>
              ) : (
                evidenceLabels[method.evidence]
              )}
            </small>
          </div>
        ))}
      </div>
    </section>
  )
}
