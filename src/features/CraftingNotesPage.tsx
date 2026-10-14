import { useEffect, useMemo, useState } from 'react'
import { loadItemDetail, loadManifest, loadSearchIndex } from '../crafting/catalogClient'
import { sourceItemId, type ItemDetail, type SearchItem } from '../crafting/types'

const methods: Record<string, string> = {
  HOUSE: '공방 제작',
  HEAT: '가열하기',
  CHOP: '장작패기',
  GRIND: '빻기',
  DRY: '말리기',
  SHAKE: '흔들어 섞기',
  FILTER: '솎아내기',
  COOK: '요리',
  ALCHEMY: '연금',
}

function IngredientBranch({
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
  const cycle = ancestors.includes(id)
  const toggle = async () => {
    if (cycle) return
    setOpen(!open)
    if (!open && !detail) {
      setLoading(true)
      setError('')
      try {
        setDetail(await loadItemDetail(id))
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
        <button className="crafting-item-link" onClick={() => onSelect(id)}>
          {names.get(id) ?? `아이템 ${id}`}
        </button>
        <span>{count === undefined ? '수량 미제공' : `${count.toLocaleString('ko-KR')}개`}</span>
      </div>
      {cycle && <small>순환 제작식 · 상위 재료에 이미 포함됨</small>}
      {open && (
        <div className="crafting-branch">
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
                    ancestors={[...ancestors, id]}
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

export function CraftingNotesPage({
  itemId,
  onSelect,
}: {
  itemId?: string
  onSelect: (id: string) => void
}) {
  const [index, setIndex] = useState<SearchItem[]>([])
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(80)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState('')
  const [reload, setReload] = useState(0)
  const [selection, setSelection] = useState<{ id: string; detail?: ItemDetail; error?: string }>()
  useEffect(() => {
    let active = true
    Promise.all([loadSearchIndex(), loadManifest()])
      .then(([items, manifest]) => {
        if (active) {
          setIndex(items)
          setUpdatedAt(manifest.generatedAt)
          setError('')
        }
      })
      .catch((e) => {
        if (active) setError(e.message)
      })
    return () => {
      active = false
    }
  }, [reload])
  useEffect(() => {
    let active = true
    if (itemId)
      loadItemDetail(itemId)
        .then((detail) => {
          if (active) setSelection({ id: itemId, detail })
        })
        .catch((e) => {
          if (active) setSelection({ id: itemId, error: e.message })
        })
    return () => {
      active = false
    }
  }, [itemId, reload])
  const names = useMemo(() => new Map(index.map((item) => [item.id, item.name])), [index])
  const results = useMemo(() => {
    const text = query.trim().toLocaleLowerCase()
    return index.filter(
      (item) =>
        !text ||
        item.name.toLocaleLowerCase().includes(text) ||
        item.nameEn?.toLocaleLowerCase().includes(text) ||
        item.id === text,
    )
  }, [index, query])
  const current = selection?.id === itemId ? selection : undefined
  return (
    <section className="crafting-notes">
      <div className="section-title">
        <div>
          <h2>제작노트</h2>
          <p>아이템 제작식과 원재료를 찾아봅니다.</p>
        </div>
      </div>
      {updatedAt && (
        <p className="save">
          아이템 {index.length.toLocaleString('ko-KR')}종 · 추출{' '}
          {new Date(updatedAt).toLocaleString('ko-KR')}
        </p>
      )}
      {error && (
        <p role="alert">
          {error} <button onClick={() => setReload((value) => value + 1)}>다시 시도</button>
        </p>
      )}
      {!error && !index.length && <p>검색 목록 불러오는 중…</p>}
      <div className="crafting-layout">
        <aside className="crafting-search">
          <input
            aria-label="제작노트 아이템 검색"
            placeholder="아이템명 또는 ID 검색"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setLimit(80)
            }}
          />
          <p>{results.length.toLocaleString('ko-KR')}개 검색됨</p>
          <div className="crafting-results">
            {results.slice(0, limit).map((item) => (
              <button
                key={item.id}
                className={itemId === item.id ? 'primary' : ''}
                onClick={() => onSelect(item.id)}
              >
                <span>{item.name}</span>
                <small>
                  {item.id} · {item.category}
                </small>
              </button>
            ))}
          </div>
          {results.length > limit && (
            <button onClick={() => setLimit((value) => value + 80)}>더 보기</button>
          )}
        </aside>
        <article className="crafting-detail">
          {!itemId && (
            <p>
              왼쪽에서 아이템을 선택하세요. 재료의 + 버튼을 누르면 원재료까지 펼쳐 볼 수 있습니다.
            </p>
          )}
          {itemId && !current && <p>아이템 불러오는 중…</p>}
          {current?.error && (
            <p role="alert">
              {current.error}{' '}
              <button onClick={() => setReload((value) => value + 1)}>다시 시도</button>
            </p>
          )}
          {current?.detail && (
            <>
              <h2>{current.detail.item.name}</h2>
              <p className="save">
                ID {itemId} · {current.detail.item.nameEn} · {current.detail.item.grade}
              </p>
              {current.detail.item.description && (
                <p className="crafting-description">
                  {current.detail.item.description.replace(/<[^>]*>/g, '')}
                </p>
              )}
              <h3>제작식 · {current.detail.recipes.length}개</h3>
              <p className="save">
                각 수량은 해당 제작식 1회 입력 기준입니다. 생산 수량·대성공에 따라 실제 소모량은
                달라집니다. 한국판과 해외판 패치 차이가 있을 수 있습니다.
              </p>
              {!current.detail.recipes.length && <p>제작식이 등록되지 않았습니다.</p>}
              {current.detail.recipes.map((recipe, position) => (
                <div className="crafting-recipe" key={`${itemId}-${position}`}>
                  <h4>
                    {methods[recipe.type] ?? recipe.type}
                    {recipe.station ? ` · ${recipe.station}` : ''}
                  </h4>
                  <ul>
                    {recipe.inputs.map((input, i) => (
                      <IngredientBranch
                        key={`${itemId}-${position}-${i}`}
                        id={sourceItemId(input.item)}
                        count={input.count}
                        ancestors={[itemId!]}
                        names={names}
                        onSelect={onSelect}
                      />
                    ))}
                  </ul>
                </div>
              ))}
              <h3>이 재료를 사용하는 아이템</h3>
              <div className="crafting-used-in">
                {current.detail.usedIn.map((id) => (
                  <button key={id} onClick={() => onSelect(id)}>
                    {names.get(id) ?? id}
                  </button>
                ))}
              </div>
              <details>
                <summary>전체 아이템 속성</summary>
                <pre className="crafting-raw">{JSON.stringify(current.detail.item, null, 2)}</pre>
              </details>
            </>
          )}
        </article>
      </div>
    </section>
  )
}
