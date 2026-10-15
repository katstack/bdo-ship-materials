import { useMemo, useRef } from 'react'
import { buildPlanTree, type PlanTreeNode } from '../crafting/planTree'
import type { PlanResult } from '../crafting/planCalculation'
import type { CraftingPlan } from '../crafting/planTypes'
import type { ItemDetail } from '../crafting/types'
import { CraftingPlanTable } from './CraftingPlanTable'

const n = (value: number) => value.toLocaleString('ko-KR')

export function CraftingPlanTree({
  result,
  plan,
  update,
  names,
  details,
  onSelect,
}: {
  result: PlanResult
  plan: CraftingPlan
  update: (plan: CraftingPlan) => boolean
  names: ReadonlyMap<string, string>
  details?: ReadonlyMap<string, ItemDetail>
  onSelect: (id: string) => void
}) {
  const roots = useMemo(() => buildPlanTree(result), [result])
  const rootRef = useRef<HTMLDivElement>(null)
  const focusShared = (key: string) => {
    const target = [
      ...(rootRef.current?.querySelectorAll<HTMLElement>('[data-route-key]') ?? []),
    ].find((element) => element.dataset.routeKey === key)
    if (!target) return
    let parent = target.parentElement
    while (parent && parent !== rootRef.current) {
      if (parent instanceof HTMLDetailsElement) parent.open = true
      parent = parent.parentElement
    }
    target.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    target.focus({ preventScroll: true })
  }
  const renderNode = (node: PlanTreeNode, path: string) => (
    <li key={path}>
      <div className={`crafting-tree-node${node.shared ? ' is-shared' : ''}`}>
        <div
          className="crafting-tree-node-title"
          data-route-key={!node.shared ? node.key : undefined}
          tabIndex={-1}
        >
          <strong>{node.row.name}</strong>
          <span>이 경로 필요 {n(node.required)}개</span>
        </div>
        <p className="save crafting-tree-node-meta">
          {node.external
            ? '별도 수급 경로'
            : node.row.calculationMode === 'craft'
              ? `직접 제작 · ${n(node.row.crafts)}회 (합산)`
              : '직접 수급·구매'}
          {node.row.required !== node.required && ` · 전체 필요 ${n(node.row.required)}개`}
          {node.row.owned >= node.row.required && ' · 재고 충족'}
        </p>
        {node.shared ? (
          <button className="crafting-tree-shared" onClick={() => focusShared(node.key)}>
            공유 재료 · 먼저 나온 경로에서 설정
          </button>
        ) : node.external ? (
          <p className="save">
            순환 제작·장비 회수에 투입할 재료입니다. 재고는 합산 목록에서 한 번만 반영합니다.
          </p>
        ) : (
          <details className="crafting-tree-settings" data-settings-item={node.row.id}>
            <summary>
              {node.row.calculationMode === 'craft'
                ? '제작식·수급 방식 설정'
                : '수급 방식·제작식 설정'}
            </summary>
            <CraftingPlanTable
              rows={[node.row]}
              crafted
              plan={plan}
              update={update}
              names={names}
              details={details}
              onSelect={onSelect}
              layout="node"
            />
          </details>
        )}
      </div>
      {!!node.children.length && (
        <details className="crafting-tree-branch" open>
          <summary>투입 재료 {node.children.length}종 · 합산 제작 기준</summary>
          <ul>{node.children.map((child, i) => renderNode(child, `${path}/${i}:${child.key}`))}</ul>
        </details>
      )}
    </li>
  )
  return (
    <div className="crafting-plan-tree" ref={rootRef}>
      <p className="save">
        위 아이템을 만들기 위해 아래 재료가 필요합니다. 공유 재료의 재고·제작 횟수는 전체 목표에서
        한 번만 계산합니다.
      </p>
      <ul>{roots.map((root) => renderNode(root, root.key))}</ul>
    </div>
  )
}
