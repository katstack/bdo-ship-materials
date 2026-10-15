import { useState } from 'react'
import type { PlanResult, PlanRow } from '../crafting/planCalculation'
import { materialPaths } from '../crafting/planTree'
import type { CraftingPlan } from '../crafting/planTypes'
import { QuantityInput } from './QuantityInput'

export function CraftingSupplySummary({
  rows,
  names,
  sort = 'name',
  result,
  plan,
  update,
}: {
  rows: PlanRow[]
  names: ReadonlyMap<string, string>
  sort?: 'name' | 'shortage'
  result: PlanResult
  plan: CraftingPlan
  update: (plan: CraftingPlan) => boolean
}) {
  const [includeCrafted, setIncludeCrafted] = useState(false)
  const required = rows
    .filter((row) => includeCrafted || row.purchaseRequired > 0 || row.requestedMode === 'obtain')
    .sort((a, b) =>
      sort === 'shortage'
        ? b.purchaseRequired - a.purchaseRequired || a.name.localeCompare(b.name, 'ko')
        : a.name.localeCompare(b.name, 'ko'),
    )
  const n = (value: number) => value.toLocaleString('ko-KR')
  return (
    <section>
      <h3>필요 재료 · {required.length}종</h3>
      <p className="save">
        직접 준비할 재료의 합계입니다. 사용처를 펼치면 목표부터 이어지는 제작 경로를 볼 수 있습니다.
      </p>
      <label className="crafting-summary-option">
        <input
          type="checkbox"
          checked={includeCrafted}
          onChange={(event) => setIncludeCrafted(event.target.checked)}
        />{' '}
        중간 제작품·목표 재고도 보기
      </label>
      {required.length ? (
        <div className="table-scroll crafting-supply-table">
          <table>
            <thead>
              <tr>
                <th>아이템</th>
                <th>총 필요</th>
                <th>제작 재고</th>
                <th>별도 수급 필요</th>
              </tr>
            </thead>
            <tbody>
              {required.map((row) => (
                <tr key={row.id} data-supply-item-id={row.id}>
                  <td>
                    {row.name}
                    {row.calculationMode === 'craft' && (
                      <small className="save">
                        직접 제작{row.purchaseRequired > 0 ? ' · 일부 별도 수급' : ''}
                      </small>
                    )}
                    <MaterialUsage row={row} result={result} names={names} />
                  </td>
                  <td>{n(row.required)}</td>
                  <td>
                    <QuantityInput
                      min={0}
                      aria-label={`${row.name} 제작 재고`}
                      value={row.owned}
                      onValueChange={(value) =>
                        update({ ...plan, inventory: { ...plan.inventory, [row.id]: value } })
                      }
                    />
                  </td>
                  <td className={row.purchaseRequired ? 'short' : 'save'}>
                    {n(row.purchaseRequired)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="save">추가 수급할 재료가 없습니다.</p>
      )}
    </section>
  )
}

function MaterialUsage({
  row,
  result,
  names,
}: {
  row: PlanRow
  result: PlanResult
  names: ReadonlyMap<string, string>
}) {
  return (
    <details className="crafting-material-usage">
      <summary>왜 필요한가?{row.isGoal ? ' · 목표' : ''}</summary>
      {row.usages.map((usage, i) => (
        <p key={i}>
          {result.rows.find((item) => item.id === usage.parentId)?.name ??
            names.get(usage.parentId) ??
            usage.parentId}{' '}
          · {usage.count.toLocaleString('ko-KR')}개
        </p>
      ))}
      <small className="save">목표 경로 · 최대 5개 표시</small>
      {materialPaths(result, row.id).map((path, i) => (
        <p className="crafting-usage-path" key={`path-${i}`}>
          {path
            .map((id) => result.rows.find((item) => item.id === id)?.name ?? names.get(id) ?? id)
            .join(' → ')}
        </p>
      ))}
      {row.issues.map((issue, i) => (
        <p key={`issue-${i}`}>{issue.message}</p>
      ))}
    </details>
  )
}
