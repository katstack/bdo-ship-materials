import { itemByMaterialId, itemByName, type ItemRecord } from '../data/items'
import type { ProcessingIngredient } from '../types'

type TreeItem = Pick<ItemRecord, 'materialId' | 'name' | 'processingRecipes'>

const resolveIngredient = (ingredient: ProcessingIngredient): TreeItem =>
  (ingredient.materialId && itemByMaterialId[ingredient.materialId]) ||
  itemByName[ingredient.name] || {
    materialId: ingredient.materialId || ingredient.name,
    name: ingredient.name,
  }

type CraftingTreeNodeProps = {
  item: TreeItem
  requiredQuantity?: number
  ancestors: Set<string>
}

function CraftingTreeNode({ item, requiredQuantity, ancestors }: CraftingTreeNodeProps) {
  const hasCycle = ancestors.has(item.materialId)
  const recipes = hasCycle ? [] : item.processingRecipes || []
  const nextAncestors = new Set(ancestors).add(item.materialId)

  return (
    <li className="crafting-tree-node">
      <div className="crafting-tree-item">
        <b>{item.name}</b>
        {requiredQuantity !== undefined ? (
          <span>필요 {requiredQuantity.toLocaleString('ko-KR')}개</span>
        ) : null}
        {hasCycle ? <small>순환 참조 감지</small> : null}
        {!hasCycle && recipes.length === 0 ? <small>원재료 또는 제작식 미등록</small> : null}
      </div>
      {recipes.map((recipe, recipeIndex) => (
        <div
          className="crafting-tree-recipe"
          key={`${item.materialId}-${recipe.method}-${recipeIndex}`}
        >
          <b>{recipe.method}</b>
          {recipes.length > 1 ? <small>대체 제작식 {recipeIndex + 1}</small> : null}
          {recipe.result ? <small>결과 · {recipe.result}</small> : null}
          <ul>
            {recipe.ingredients.map((ingredient, ingredientIndex) => {
              const child = resolveIngredient(ingredient)
              return (
                <CraftingTreeNode
                  key={`${child.materialId}-${ingredientIndex}`}
                  item={child}
                  requiredQuantity={ingredient.quantity}
                  ancestors={nextAncestors}
                />
              )
            })}
          </ul>
        </div>
      ))}
    </li>
  )
}

export function CraftingTree({ materialId }: { materialId: string }) {
  const item = itemByMaterialId[materialId]
  if (!item?.processingRecipes?.length) return null

  return (
    <section className="acquisition-detail crafting-tree" aria-label="원재료까지 보는 제작 트리">
      <h3>원재료까지 보기</h3>
      <p>선택한 재료 1개를 기준으로, 알려진 가공식을 원재료 또는 미등록 지점까지 펼칩니다.</p>
      <ul>
        <CraftingTreeNode item={item} ancestors={new Set()} />
      </ul>
    </section>
  )
}
