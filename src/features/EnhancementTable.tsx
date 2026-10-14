import type { SourceItem, EnhancementLevel } from '../crafting/types'

const labels: Record<string, string> = {
  MAX_DUR_ADD: '선박 최대 내구도',
  HAETAE_BLESSING: '무게 한도',
  MAXIMUM_FOOD: '최대 식량',
  MOVE_ADD: '속도',
  ACC_ADD: '가속도',
  TORQUE_ADD: '회전력',
  BRAKE_ADD: '제동',
  DAM_REDUCE_EFFECT: '피해 감소율',
  SHIP_MON_DAM_ADD_1: '선박·해양 몬스터 추가 피해',
  SHIP_MON_DAM_ADD_9: '선박·해양 몬스터 추가 피해',
  CANNON_ROLOADING_SPEED: '함포 재장전 속도',
  CANNON_DAM_CAL: '함포 피해 계산',
  CANNON_DAM_CARAVEL: '무역선 함포 피해 계산',
  CANNON_DAM_FRIGATE: '호위함 함포 피해 계산',
  DUR_INCRE: '내구도 관련 효과',
}
const statsOf = (level: EnhancementLevel) =>
  level.effects?.flatMap((effect) => effect.stats ?? []) ?? []

export function EnhancementTable({ item }: { item: SourceItem }) {
  const levels = item.enhancement?.levels
  if (!levels?.length) return null
  const columns = new Map<string, string>()
  const unresolved = new Map<string, string>()
  levels.forEach((level) =>
    statsOf(level).forEach((stat) => {
      const label = labels[stat.func] ?? stat.stat ?? stat.func
      if (typeof stat.value === 'number') columns.set(stat.func, label)
      else unresolved.set(stat.func, label)
    }),
  )
  return (
    <section className="enhancement-table">
      <h3>강화별 성능</h3>
      <p className="save">
        {item.enhancementSource === 'KR enchantstaticstatus'
          ? '한국 클라이언트에서 추출한 장착 효과'
          : '클라이언트에서 추출한 강화 효과'}
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>강화</th>
              <th>장비 내구도</th>
              {[...columns].map(([key, label]) => (
                <th key={key}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {levels.map((level) => (
              <tr key={level.level}>
                <td>+{level.level}</td>
                <td>{level.durability?.toLocaleString('ko-KR') ?? '—'}</td>
                {[...columns.keys()].map((key) => {
                  const stat = statsOf(level).find(
                    (stat) => stat.func === key && typeof stat.value === 'number',
                  )
                  return (
                    <td key={key}>
                      {stat
                        ? `${stat.op ?? ''}${stat.value!.toLocaleString('ko-KR', { maximumFractionDigits: 4 })}${stat.unit ? ` ${stat.unit}` : ''}`
                        : '—'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!!unresolved.size && (
        <p className="save">
          수치 미해석: {[...unresolved.values()].join(' · ')}. 클라이언트에 효과 식별자만 있어
          숫자를 표시하지 않습니다.
        </p>
      )}
    </section>
  )
}
