import type { AggregateMaterial, AppData, MaterialExchangeSortKey } from '../types'
import { number } from '../utils'

export type BarterRow = AggregateMaterial & {
  exchangeKey: string
  outputQuantity: number
  variableOutput: boolean
  afterExchangeShortage: number
  progressGain: number
  exchangeCrowValue?: number
  priority: number
}

type BarterPriorityTableProps = {
  rows: BarterRow[]
  sort: AppData['materialExchangeSort']
  onSort: (key: MaterialExchangeSortKey) => void
  showSource: (id: string) => void
  session: AppData['barterSession']
  flashId: string | null
  onAdd: (row: BarterRow) => void
  onRemove: (row: BarterRow) => void
  onComplete: (row: BarterRow) => void
}

export function BarterPriorityTable({
  rows,
  sort,
  onSort,
  showSource,
  session,
  flashId,
  onAdd,
  onRemove,
  onComplete,
}: BarterPriorityTableProps) {
  const header = (label: string, key: MaterialExchangeSortKey) => (
    <th>
      <button className="sort-button" onClick={() => onSort(key)}>
        {label}
        {sort.key === key ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  )

  return (
    <div className="table-wrap">
      <table className="barter-table">
        <thead>
          <tr>
            {header('추천', 'priority')}
            {header('재료', 'name')}
            {header('부족', 'shortage')}
            {header('물교 비율', 'outputQuantity')}
            {header('교환 후 부족', 'afterExchangeShortage')}
            {header('진행률 증가', 'progressGain')}
            {header('이번 물교 절감', 'exchangeCrowValue')}
            {header('전량 구매 까주', 'crowCoinTotal')}
            <th>이번 갱신</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const count = session.exchangeCounts[row.exchangeKey] || 0
            return (
              <tr
                key={row.id}
                className={`${count ? 'barter-listed' : ''} ${flashId === row.exchangeKey ? 'barter-flash' : ''}`}
                onClick={() => onAdd(row)}
                onContextMenu={(event) => {
                  event.preventDefault()
                  onRemove(row)
                }}
              >
                <td>
                  <b className={index < 3 ? 'barter-rank top' : 'barter-rank'}>{index + 1}</b>
                </td>
                <td>
                  <button
                    className="link-button"
                    onClick={(event) => {
                      event.stopPropagation()
                      showSource(row.id)
                    }}
                  >
                    {row.name}
                  </button>
                  <small className="barter-count">
                    이번 갱신: {number(count)}회 교환 · 1회당 {number(row.outputQuantity)}개
                  </small>
                </td>
                <td className="shortage">{number(row.shortage)}</td>
                <td>
                  1 : {number(row.outputQuantity)}
                  {row.variableOutput ? (
                    <small className="variable-rate"> 변동 품목</small>
                  ) : row.outputQuantity === 1 ? (
                    <small className="default-rate"> 기본</small>
                  ) : (
                    ''
                  )}
                </td>
                <td>{number(row.afterExchangeShortage)}</td>
                <td>+{row.progressGain}%</td>
                <td className={row.exchangeCrowValue === undefined ? 'no-plan' : 'barter-value'}>
                  {row.exchangeCrowValue === undefined
                    ? '단가 미확인'
                    : `${number(row.exchangeCrowValue)} 주화`}
                </td>
                <td>
                  {row.crowCoinTotal === undefined ? '—' : `${number(row.crowCoinTotal)} 주화`}
                </td>
                <td>
                  {count ? (
                    <button
                      className="primary barter-complete"
                      onClick={(event) => {
                        event.stopPropagation()
                        onComplete(row)
                      }}
                    >
                      1회 거래 완료
                    </button>
                  ) : (
                    <small className="barter-pending">거래 지정 필요</small>
                  )}
                </td>
              </tr>
            )
          })}
          {!rows.length && (
            <tr>
              <td colSpan={9} className="empty">
                현재 범위에 부족한 재료가 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
