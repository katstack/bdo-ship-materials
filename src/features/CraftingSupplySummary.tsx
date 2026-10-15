import type { PlanRow } from '../crafting/planCalculation'

export function CraftingSupplySummary({
  rows,
  names,
  sort = 'name',
}: {
  rows: PlanRow[]
  names: ReadonlyMap<string, string>
  sort?: 'name' | 'shortage'
}) {
  const required = rows
    .filter((row) => row.purchaseRequired > 0 || row.requestedMode === 'obtain')
    .sort((a, b) =>
      sort === 'shortage'
        ? b.purchaseRequired - a.purchaseRequired || a.name.localeCompare(b.name, 'ko')
        : a.name.localeCompare(b.name, 'ko'),
    )
  const n = (value: number) => value.toLocaleString('ko-KR')
  return (
    <section>
      <h3>합산 수급 목록 · {required.length}종</h3>
      <p className="save">
        경로 선택을 반영한 별도 수급량입니다. 재고는 제작 경로와 공유하며 한 번만 배분합니다.
      </p>
      {required.length ? (
        <div className="table-scroll crafting-supply-table">
          <table>
            <thead>
              <tr>
                <th>아이템</th>
                <th>총 필요</th>
                <th>제작 재고</th>
                <th>별도 수급 필요</th>
                <th>필요한 곳</th>
              </tr>
            </thead>
            <tbody>
              {required.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{n(row.required)}</td>
                  <td>{n(row.owned)}</td>
                  <td className={row.purchaseRequired ? 'short' : 'save'}>
                    {n(row.purchaseRequired)}
                  </td>
                  <td>
                    <details>
                      <summary>
                        사용처 {row.usages.length}곳{row.isGoal ? ' · 목표' : ''}
                      </summary>
                      {row.usages.map((usage, i) => (
                        <p key={i}>
                          {names.get(usage.parentId) ?? usage.parentId} · {n(usage.count)}개
                        </p>
                      ))}
                      {row.issues.map((issue, i) => (
                        <p key={`issue-${i}`}>{issue.message}</p>
                      ))}
                    </details>
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
