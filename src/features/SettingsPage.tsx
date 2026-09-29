import type { ChangeEvent, RefObject } from 'react'
import { defaultEquipmentOrder, defaultUpgradeHull, hullLabel } from '../catalog'
import type { AppData, Hull, Ship } from '../types'
import type { DriveStatus } from '../useDriveSync'

interface SettingsPageProps {
  data: AppData
  drive: {
    status: DriveStatus
    error: string
    authorize: () => void
    reauthorize: () => void
    disconnect: () => void
    hasRememberedConnection: boolean
  }
  importRef: RefObject<HTMLInputElement | null>
  onEditShip: (ship: Ship) => void
  onRemoveShip: (ship: Ship) => void
  onAddShip: (hull: Hull) => void
  onExport: () => void
  onImport: (event: ChangeEvent<HTMLInputElement>) => void
  onRestoreSample: () => void
  onClear: () => void
}

export function SettingsPage({
  data,
  drive,
  importRef,
  onEditShip,
  onRemoveShip,
  onAddShip,
  onExport,
  onImport,
  onRestoreSample,
  onClear,
}: SettingsPageProps) {
  return (
    <section className="settings">
      <div className="panel">
        <h2>내 함대</h2>
        <p>게임 제작식은 고정입니다. 선박 이름, 종류, 현재 진행 단계와 보유 수량만 관리합니다.</p>
        {data.ships.map((ship) => (
          <div className="ship-edit" key={ship.id}>
            <input
              value={ship.name}
              onChange={(event) => onEditShip({ ...ship, name: event.target.value })}
            />
            <select
              value={ship.hull}
              onChange={(event) => {
                const hull = event.target.value as Hull
                onEditShip({
                  ...ship,
                  hull,
                  activeStage: hull === 'trade' || hull === 'warship' ? 1 : 3,
                  upgradeHull:
                    hull === 'trade' || hull === 'warship' ? defaultUpgradeHull[hull] : undefined,
                  equipmentOrder: [...defaultEquipmentOrder[hull]],
                })
              }}
            >
              {(Object.keys(hullLabel) as Hull[]).map((hull) => (
                <option value={hull} key={hull}>
                  {hullLabel[hull]}
                </option>
              ))}
            </select>
            <button className="danger" onClick={() => onRemoveShip(ship)}>
              제거
            </button>
          </div>
        ))}
        <div className="add-ships">
          {(['trade', 'warship', 'balance', 'advance', 'volante', 'valor'] as Hull[]).map(
            (hull) => (
              <button key={hull} onClick={() => onAddShip(hull)}>
                + {hullLabel[hull]}
              </button>
            ),
          )}
        </div>
      </div>
      <div className="panel manage">
        <h2>Google Drive 동기화</h2>
        <p>
          제공된 OAuth Client ID로만 연결합니다. 진행 데이터만 앱 전용 Drive 저장소에 동기화합니다.
        </p>
        {drive.status === 'disconnected' || drive.status === 'failed' ? (
          <button
            className="primary"
            onClick={drive.hasRememberedConnection ? drive.reauthorize : drive.authorize}
          >
            {drive.hasRememberedConnection ? 'Google Drive 동기화 재개' : 'Google Drive 연결'}
          </button>
        ) : (
          <button onClick={drive.disconnect}>Drive 연결 해제</button>
        )}
        {drive.error && <p className="sync-error">{drive.error}</p>}
      </div>
      <div className="panel manage">
        <h2>진행 데이터 백업</h2>
        <p>함대 구성과 공유 재고만 백업합니다. 게임 레시피는 앱에 고정되어 있습니다.</p>
        <button onClick={onExport}>JSON 내보내기</button>
        <button onClick={() => importRef.current?.click()}>JSON 가져오기</button>
        <input hidden ref={importRef} type="file" accept="application/json" onChange={onImport} />
        <button onClick={onRestoreSample}>샘플 진행 복원</button>
        <button className="danger" onClick={onClear}>
          로컬 데이터 초기화
        </button>
      </div>
    </section>
  )
}
