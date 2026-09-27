import type { AppData } from '../types'
import { clamp, number } from '../utils'

type BarterSessionControlsProps = {
  session: AppData['barterSession']
  onChange: (patch: Partial<AppData['barterSession']>) => void
  onReset: () => void
}

export function BarterSessionControls({ session, onChange, onReset }: BarterSessionControlsProps) {
  const totalExchanges = Object.values(session.exchangeCounts).reduce(
    (sum, count) => sum + count,
    0,
  )
  const needed = totalExchanges * session.costPerExchange

  return (
    <div className="barter-session">
      <div>
        <b>현재 재료 갱신</b>
        <small>좌클릭 +1 · 우클릭 -1 · 실제 교환 후 우측 완료 버튼을 누르세요.</small>
      </div>
      <label>
        회당 필요 교섭력
        <input
          className="num"
          type="number"
          min="0"
          value={session.costPerExchange}
          onChange={(event) => onChange({ costPerExchange: clamp(event.target.valueAsNumber) })}
        />
      </label>
      <div className="barter-total">
        <small>총 필요 교섭력 · {number(totalExchanges)}회</small>
        <b>{number(needed)}</b>
      </div>
      <label className="barter-check">
        <input
          type="checkbox"
          checked={session.addToInventory}
          onChange={(event) => onChange({ addToInventory: event.target.checked })}
        />
        완료 시 재고 반영
      </label>
      <button onClick={onReset}>목록 초기화</button>
    </div>
  )
}
