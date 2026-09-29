import type { AggregateMaterial, MaterialSortKey } from '../types'
import { clamp, number } from '../utils'

type MaterialTableProps = {
  rows: AggregateMaterial[]
  setOwned: (id: string, quantity: number) => void
  showSource: (id: string) => void
  showSupply: (detail: { materialId: string; period: 'daily' | 'weekly' }) => void
  sort: { key: MaterialSortKey; direction: 'asc' | 'desc' }
  onSort: (key: MaterialSortKey) => void
}

const Progress = ({ value }: { value: number }) => (
  <div className="progress">
    <i
      className={value === 100 ? 'done' : value >= 70 ? 'near' : ''}
      style={{ width: `${value}%` }}
    />
    <span>{value}%</span>
  </div>
)

export function MaterialTable({
  rows,
  setOwned,
  showSource,
  showSupply,
  sort,
  onSort,
}: MaterialTableProps) {
  const header = (label: string, key: MaterialSortKey) => (
    <th>
      <button className="sort-button" onClick={() => onSort(key)}>
        {label}
        {sort.key === key ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  )

  return (
    <div className="table-wrap">
      <table className="material-table">
        <thead>
          <tr>
            {header('재료', 'name')}
            {header('필요', 'required')}
            {header('보유', 'owned')}
            {header('부족', 'shortage')}
            {header('진행률', 'progress')}
            {header('일일 수급', 'dailySupply')}
            {header('주간 수급', 'weeklySupply')}
            {header('수급 완료까지', 'estimatedDays')}
            {header('까마귀 주화/개', 'crowCoinPrice')}
            {header('부족분 주화', 'crowCoinTotal')}
            {header('사용처', 'recipes')}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <button className="link-button" onClick={() => showSource(row.id)}>
                  {row.name}
                </button>
              </td>
              <td>{number(row.required)}</td>
              <td>
                <input
                  className="num"
                  type="number"
                  min="0"
                  value={row.owned}
                  onChange={(event) => setOwned(row.id, clamp(event.target.valueAsNumber))}
                />
              </td>
              <td className={row.shortage ? 'shortage' : ''}>{number(row.shortage)}</td>
              <td>
                <Progress value={row.progress} />
              </td>
              <td>
                <button
                  className="supply-cell"
                  onClick={() => showSupply({ materialId: row.id, period: 'daily' })}
                >
                  {number(row.dailySupply)}
                </button>
              </td>
              <td>
                <button
                  className="supply-cell"
                  onClick={() => showSupply({ materialId: row.id, period: 'weekly' })}
                >
                  {number(row.weeklySupply)}
                </button>
              </td>
              <td className={row.estimatedDays === undefined && row.shortage ? 'no-plan' : ''}>
                {row.estimatedDays === undefined
                  ? row.shortage
                    ? '계획 없음'
                    : '완료'
                  : `약 ${number(row.estimatedDays)}일`}
              </td>
              <td>{row.crowCoinPrice === undefined ? '—' : number(row.crowCoinPrice)}</td>
              <td>{row.crowCoinTotal === undefined ? '—' : number(row.crowCoinTotal)}</td>
              <td>
                <small>
                  {row.recipes.slice(0, 2).join(', ')}
                  {row.recipes.length > 2 ? ' 외' : ''}
                </small>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
