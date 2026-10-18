import type { Ship } from '../types'
import { hullLabel, stageLabelForHull } from '../catalog'

interface Props {
  ships: Ship[]
  selected: string
  onSelect: (id: string) => void
}
export function FleetSelector({ ships, selected, onSelect }: Props) {
  const currentShip = ships.find((ship) => ship.id === selected)
  return (
    <div className="fleet-context">
      <label htmlFor="current-ship">
        <span>현재 선박</span>
        <select
          id="current-ship"
          value={selected}
          onChange={(event) => onSelect(event.target.value)}
          disabled={!ships.length}
        >
          {!ships.length && <option value="">등록한 선박이 없습니다</option>}
          {ships.map((ship) => (
            <option value={ship.id} key={ship.id}>
              {ship.name} · {hullLabel[ship.hull]}
            </option>
          ))}
        </select>
      </label>
      {currentShip && (
        <span className="fleet-context-detail">
          현재 단계 · {stageLabelForHull(currentShip.hull, currentShip.activeStage)}
        </span>
      )}
    </div>
  )
}
