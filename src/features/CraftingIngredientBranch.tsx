import { useState } from 'react'
import { loadItemDetail } from '../crafting/catalogClient'
import { sourceItemId, resolveIngredientReference, type ItemDetail } from '../crafting/types'
import { craftingMethods as methods } from '../crafting/methods'
import { AcquisitionMethods } from './AcquisitionMethods'

export function IngredientBranch({
  id,
  count,
  ancestors,
  names,
  onSelect,
}: {
  id: string
  count?: number
  ancestors: string[]
  names: Map<string, string>
  onSelect: (id: string) => void
}) {
  const [detail, setDetail] = useState<ItemDetail>()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const reference = resolveIngredientReference(id, names)
  const cycle = ancestors.includes(reference.id)
  const toggle = async () => {
    if (cycle) return
    setOpen(!open)
    if (!open && !detail) {
      setLoading(true)
      setError('')
      try {
        setDetail(await loadItemDetail(reference.id))
      } catch (e) {
        setError(e instanceof Error ? e.message : '불러오기 실패')
      } finally {
        setLoading(false)
      }
    }
  }
  return (
    <li>
      <div className="crafting-ingredient">
        <button onClick={toggle} disabled={cycle} aria-expanded={open}>
          {cycle ? '↻' : open ? '−' : '+'}
        </button>
        <button className="crafting-item-link" onClick={() => onSelect(reference.id)}>
          {reference.enhancementLevel ? `+${reference.enhancementLevel} ` : ''}
          {names.get(reference.id) ?? `아이템 ${id}`}
        </button>
        <span>{count === undefined ? '수량 미제공' : `${count.toLocaleString('ko-KR')}개`}</span>
      </div>
      {cycle && <small>순환 제작식 · 상위 재료에 이미 포함됨</small>}
      {open && (
        <div className="crafting-branch">
          {reference.enhancementLevel > 0 && (
            <p className="save">제작 후 +{reference.enhancementLevel} 강화가 필요한 재료입니다.</p>
          )}
          {loading && <p>재료 불러오는 중…</p>}
          {error && (
            <p role="alert">
              {error}{' '}
              <button
                onClick={() => {
                  setOpen(false)
                  setError('')
                }}
              >
                닫기
              </button>
            </p>
          )}
          {detail && !detail.recipes.length && (
            <p>등록된 제작식 없음 · 채집/구매 재료 또는 제작 정보 미제공</p>
          )}
          {detail && (
            <details>
              <summary>획득 방법 보기</summary>
              <AcquisitionMethods detail={detail} />
            </details>
          )}
          {detail?.recipes.map((recipe, index) => (
            <div key={index}>
              <small>
                {methods[recipe.type] ?? recipe.type}
                {recipe.station ? ` · ${recipe.station}` : ''}
              </small>
              <ul>
                {recipe.inputs.map((input, position) => (
                  <IngredientBranch
                    key={position}
                    id={sourceItemId(input.item)}
                    count={input.count}
                    ancestors={[...ancestors, reference.id]}
                    names={names}
                    onSelect={onSelect}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </li>
  )
}
