import { useEffect, useMemo, useState } from 'react'
import {
  loadItemDetail,
  loadManifest,
  loadSearchIndex,
  loadRecipeIndex,
} from '../crafting/catalogClient'
import { displayItemName, searchCatalog } from '../crafting/search'
import { EnhancementTable } from './EnhancementTable'
import { AcquisitionMethods } from './AcquisitionMethods'
import { IngredientBranch } from './CraftingIngredientBranch'
import { QuantityInput } from './QuantityInput'
import { craftingMethods as methods } from '../crafting/methods'
import { defaultRecipeIndex, recipeLabel } from '../crafting/recipeSelection'
import { recipeId } from '../crafting/recipeCatalog'
import {
  sourceItemId,
  type ItemDetail,
  type SearchItem,
  type RecipeSearchItem,
} from '../crafting/types'

export function CraftingNotesPage({
  itemId,
  onSelect,
  onAddToPlan,
  selectedRecipeId,
  onSelectRecipe,
}: {
  itemId?: string
  selectedRecipeId?: string
  onSelectRecipe?: (id: string) => void
  onSelect: (id: string) => void
  onAddToPlan?: (
    id: string,
    name: string,
    quantity: number,
    recipeIndex: number,
    mode: 'craft' | 'obtain',
    stableRecipeId?: string,
  ) => void
}) {
  const [index, setIndex] = useState<SearchItem[]>([])
  const [recipes, setRecipes] = useState<RecipeSearchItem[]>([])
  const [method, setMethod] = useState('all')
  const [kind, setKind] = useState('production')
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(80)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState('')
  const [reload, setReload] = useState(0)
  const [selection, setSelection] = useState<{ id: string; detail?: ItemDetail; error?: string }>()
  const [detailTab, setDetailTab] = useState<'materials' | 'acquisition' | 'stats' | 'usage'>(
    'materials',
  )
  const [quantity, setQuantity] = useState(1)
  const [recipeSelection, setRecipeSelection] = useState<{ itemId: string; index: number }>()
  useEffect(() => {
    let active = true
    Promise.all([loadSearchIndex(), loadManifest(), loadRecipeIndex()])
      .then(([items, manifest, recipes]) => {
        if (active) {
          setIndex(items)
          setRecipes(recipes)
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
    const matching = new Set(searchCatalog(recipes, query).map((recipe) => recipe.id))
    return recipes.filter(
      (recipe) =>
        (matching.has(recipe.id) || recipe.outputId === query.trim()) &&
        (method === 'all' || recipe.type === method) &&
        (kind === 'all' || recipe.kind === kind),
    )
  }, [recipes, query, method, kind])
  const current = selection?.id === itemId ? selection : undefined
  const recipeIndex =
    (selectedRecipeId && current?.detail
      ? current.detail.recipes.findIndex((recipe) => recipeId(recipe) === selectedRecipeId)
      : recipeSelection && recipeSelection.itemId === itemId
        ? recipeSelection.index
        : undefined) ?? (current?.detail ? defaultRecipeIndex(current.detail) : 0)
  return (
    <section className="crafting-notes">
      <div className="section-title">
        <div>
          <h2>제작노트</h2>
          <p>
            레시피를 선택하고 재료·대체재·예상 생산량을 확인합니다. 아이템 상세는 재료 사전으로
            연결됩니다.
          </p>
        </div>
      </div>
      {updatedAt && (
        <p className="save">
          레시피 {recipes.length.toLocaleString('ko-KR')}개 · 추출{' '}
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
            aria-label="제작노트 레시피 검색"
            placeholder="결과물 이름 또는 아이템 ID 검색"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setLimit(80)
            }}
          />
          <label>
            제작 방법{' '}
            <select
              aria-label="레시피 제작 방법"
              value={method}
              onChange={(event) => {
                setMethod(event.target.value)
                setLimit(80)
              }}
            >
              <option value="all">전체 방법</option>
              {[...new Set(recipes.map((recipe) => recipe.type))].sort().map((type) => (
                <option key={type} value={type}>
                  {methods[type] ?? type}
                </option>
              ))}
            </select>
          </label>
          <label>
            경로 종류{' '}
            <select
              aria-label="레시피 경로 종류"
              value={kind}
              onChange={(event) => {
                setKind(event.target.value)
                setLimit(80)
              }}
            >
              <option value="production">일반 제작</option>
              <option value="recovery">장비 회수</option>
              <option value="byproduct">부산물</option>
              <option value="exchange">교환</option>
              <option value="all">전체 경로</option>
            </select>
          </label>
          <p>{results.length.toLocaleString('ko-KR')}개 레시피 검색됨</p>
          <div className="crafting-results">
            {results.slice(0, limit).map((item) => (
              <button
                key={item.id}
                className={selectedRecipeId === item.id ? 'primary' : ''}
                data-recipe-id={item.id}
                onClick={() => onSelectRecipe?.(item.id)}
              >
                <span>{item.name}</span>
                <small>
                  {methods[item.type] ?? item.type} ·{' '}
                  {item.station ??
                    {
                      production: '제작',
                      recovery: '장비 회수',
                      byproduct: '부산물',
                      exchange: '교환',
                    }[item.kind]}{' '}
                  · 재료 {item.inputs.length}칸
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
              왼쪽에서 레시피를 선택하세요. 같은 결과물도 제작 방법과 투입 재료에 따라 별도 레시피로
              표시됩니다.
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
              <h2>{displayItemName(current.detail.item, itemId!)}</h2>
              <p className="save">
                ID {itemId} · {current.detail.item.nameEn} · {current.detail.item.grade}
              </p>
              {onAddToPlan && (
                <div className="crafting-plan-toolbar">
                  <label>
                    목표 수량{' '}
                    <QuantityInput
                      aria-label="제작 목표 수량"
                      value={quantity}
                      onValueChange={setQuantity}
                    />
                  </label>
                  <button
                    disabled={recipeIndex < 0}
                    onClick={() =>
                      onAddToPlan(
                        itemId!,
                        displayItemName(current.detail!.item, itemId!),
                        quantity,
                        recipeIndex,
                        current.detail!.recipes.length ? 'craft' : 'obtain',
                        current.detail!.recipes[recipeIndex]
                          ? recipeId(current.detail!.recipes[recipeIndex])
                          : undefined,
                      )
                    }
                  >
                    제작 계획에 추가
                  </button>
                </div>
              )}
              <div className="crafting-detail-tabs" role="tablist" aria-label="아이템 상세">
                {(
                  [
                    ['materials', '제작 재료'],
                    ['acquisition', '획득처'],
                    ['stats', '성능·설명'],
                    ['usage', '사용처'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    role="tab"
                    key={key}
                    aria-selected={detailTab === key}
                    className={detailTab === key ? 'active' : ''}
                    onClick={() => setDetailTab(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {detailTab === 'stats' && (
                <div role="tabpanel" aria-label="성능·설명">
                  {current.detail.item.descriptionLocale === 'en' &&
                    current.detail.item.description && (
                      <p className="save">영문 원문 · 한국어 설명 미확보</p>
                    )}
                  {current.detail.item.description && (
                    <p className="crafting-description">
                      {current.detail.item.description
                        .replace(/<[^>]*>/g, '')
                        .replace(/\\n/g, '\n')}
                    </p>
                  )}
                  <EnhancementTable item={current.detail.item} />
                  <details>
                    <summary>전체 아이템 속성</summary>
                    <pre className="crafting-raw">
                      {JSON.stringify(current.detail.item, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
              {detailTab === 'acquisition' && (
                <div role="tabpanel" aria-label="획득처">
                  <AcquisitionMethods detail={current.detail} />
                </div>
              )}
              {detailTab === 'materials' && (
                <div role="tabpanel" aria-label="제작 재료">
                  <h3>제작식 · {current.detail.recipes.length}개</h3>
                  {!!current.detail.recipes.length && (
                    <label>
                      제작식 선택{' '}
                      <select
                        aria-label="제작노트 제작식 선택"
                        value={recipeIndex}
                        onChange={(event) => {
                          const index = Number(event.target.value)
                          if (onSelectRecipe && current?.detail?.recipes[index])
                            onSelectRecipe(recipeId(current.detail.recipes[index]))
                          else if (itemId) setRecipeSelection({ itemId, index })
                        }}
                      >
                        {current.detail.recipes.map((recipe, index) => (
                          <option key={index} value={index}>
                            {recipeLabel(recipe, index)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <p className="save">
                    각 수량은 해당 제작식 1회 입력 기준입니다. 생산 수량·대성공에 따라 실제 소모량은
                    달라집니다. 한국판과 해외판 패치 차이가 있을 수 있습니다.
                  </p>
                  {!current.detail.recipes.length && (
                    <p>제작식이 등록되지 않았습니다. 획득처 탭에서 구매·채집 정보를 확인하세요.</p>
                  )}
                  {current.detail.recipes.slice(recipeIndex, recipeIndex + 1).map((recipe) => (
                    <div className="crafting-recipe" key={recipeId(recipe)}>
                      <h4>
                        {methods[recipe.type] ?? recipe.type}
                        {recipe.station ? ` · ${recipe.station}` : ''}
                      </h4>
                      <ul>
                        {recipe.inputs.map((input, i) => (
                          <IngredientBranch
                            key={`${recipeId(recipe)}-${i}`}
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
                </div>
              )}
              {detailTab === 'usage' && (
                <div role="tabpanel" aria-label="사용처">
                  <h3>이 재료를 사용하는 아이템</h3>
                  {!current.detail.usedIn.length && (
                    <p className="save">확보한 제작식에 이 아이템을 사용하는 항목이 없습니다.</p>
                  )}
                  <div className="crafting-used-in">
                    {current.detail.usedIn.map((id) => (
                      <button key={id} onClick={() => onSelect(id)}>
                        {names.get(id) ?? id}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </article>
      </div>
    </section>
  )
}
