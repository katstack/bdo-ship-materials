import {
  defaultEnvironment,
  lifeRanks,
  lifeRankLabels,
  processingMethods,
  processingLabels,
  type CraftingEnvironment,
  type LifeProfile,
} from '../crafting/environment'
import { masteryBracket, processingBatch } from '../crafting/yieldPrediction'
import tables from '../data/masteryTables.json'
import type { CraftingPlan } from '../crafting/planTypes'
import { QuantityInput } from './QuantityInput'

export function CraftingEnvironmentPage({
  plan,
  update,
}: {
  plan: CraftingPlan
  update: (plan: CraftingPlan) => boolean
}) {
  const env = plan.environment ?? defaultEnvironment()
  const save = (next: CraftingEnvironment) => update({ ...plan, environment: next })
  const profile = (kind: 'cooking' | 'alchemy' | 'processing', label: string) => {
    const data = env[kind]
    const change = (patch: Partial<LifeProfile>) => save({ ...env, [kind]: { ...data, ...patch } })
    const bracket =
      kind !== 'processing' && data.mastery !== undefined
        ? masteryBracket(kind, data.mastery)
        : undefined
    return (
      <section className="crafting-environment-card" key={kind}>
        <h3>{label}</h3>
        <div className="crafting-plan-toolbar">
          <label>
            생활 등급{' '}
            <select
              aria-label={`${label} 생활 등급`}
              value={data.rank}
              onChange={(event) => change({ rank: event.target.value as LifeProfile['rank'] })}
            >
              {lifeRanks.map((rank) => (
                <option key={rank} value={rank}>
                  {lifeRankLabels[rank]}
                </option>
              ))}
            </select>
          </label>
          <label>
            레벨{' '}
            <QuantityInput
              aria-label={`${label} 생활 레벨`}
              value={data.level}
              max={100}
              onValueChange={(level) => change({ level })}
            />
          </label>
        </div>
        <label>
          {kind === 'processing' ? '전체 가공 숙련도 (기록용)' : '최종 숙련도'}{' '}
          <QuantityInput
            aria-label={`${label} 숙련도`}
            value={data.mastery}
            min={0}
            max={3000}
            placeholder="미입력"
            onValueChange={(mastery) => change({ mastery })}
          />
        </label>
        {bracket && (
          <p className="save">
            적용 구간 {bracket.mastery.toLocaleString('ko-KR')} · 최대 수량 확률{' '}
            {(bracket.maxProc * 100).toFixed(2)}%
          </p>
        )}
        {kind === 'cooking' && env.cooking.mastery !== undefined && (
          <p className="save">
            상위 요리 추가 확률{' '}
            {(masteryBracket('cooking', env.cooking.mastery).rareBonus! * 100).toFixed(2)}% · 대량
            요리 {(masteryBracket('cooking', env.cooking.mastery).massChance! * 100).toFixed(2)}%
          </p>
        )}
        {kind === 'processing' && (
          <>
            <p className="save">
              계산에는 아래 종류별 숙련도를 사용합니다. 전체 가공 숙련도를 다시 더하지 않습니다.
            </p>
            <div className="processing-profile-fields">
              {processingMethods.map((method) => (
                <label key={method}>
                  {processingLabels[method]}{' '}
                  <QuantityInput
                    aria-label={`${processingLabels[method]} 숙련도`}
                    value={env.processing.methods[method]}
                    min={0}
                    max={3000}
                    placeholder="미입력"
                    onValueChange={(mastery) =>
                      save({
                        ...env,
                        processing: {
                          ...env.processing,
                          methods: { ...env.processing.methods, [method]: mastery },
                        },
                      })
                    }
                  />
                  {env.processing.methods[method] !== undefined && (
                    <small>대량 가공 {processingBatch(env.processing.methods[method]!)}회분</small>
                  )}
                </label>
              ))}
            </div>
            <label className="processing-mass-toggle">
              <input
                type="checkbox"
                checked={env.massProcessing}
                onChange={(event) => save({ ...env, massProcessing: event.target.checked })}
              />{' '}
              <span>대량 가공 사용 · 묶음 내 상관을 보수적으로 반영</span>
            </label>
          </>
        )}
      </section>
    )
  }
  return (
    <section>
      <h2>제작 환경설정</h2>
      <p>
        인게임 내 정보의 생활 등급·최종 숙련도를 입력하세요. 이 설정도 제작 계획 JSON 백업에
        포함됩니다.
      </p>
      <p className="save">
        등급·레벨은 기록 및 미설정 판정에 사용합니다. 레시피 요구 등급·레벨별 기본 분포는 아직
        미확보이므로 자동 판정하지 않습니다. 표시 숙련도에는 장비·버프·등급 효과가 포함되어 있으므로
        다시 더하지 않습니다.
      </p>
      <div className="crafting-environment-grid">
        {profile('cooking', '요리')}
        {profile('alchemy', '연금')}
        {profile('processing', '가공')}
      </div>
      <section className="crafting-environment-card">
        <h3>예측 기준</h3>
        <div className="crafting-plan-toolbar">
          <label>
            필요 재료 계산{' '}
            <select
              aria-label="예측 안전 수준"
              value={env.confidence}
              onChange={(event) =>
                save({
                  ...env,
                  confidence: event.target.value as CraftingEnvironment['confidence'],
                })
              }
            >
              <option value="mean">평균 생산량 기준</option>
              <option value="95">95% 목표 확보 (모형 기준)</option>
              <option value="99">99% 목표 확보 (모형 기준)</option>
            </select>
          </label>
          <label>
            상위 요리 기본 확률 (%){' '}
            <QuantityInput
              aria-label="상위 요리 기본 확률"
              value={env.rareBaseChance === undefined ? undefined : env.rareBaseChance * 100}
              min={0}
              max={100}
              integer={false}
              placeholder="미확보"
              onValueChange={(value) => save({ ...env, rareBaseChance: value / 100 })}
            />
          </label>
        </div>
        <p>
          상위 요리 기본 확률은 레시피·생활 등급에 따라 달라질 수 있습니다. 검증한 값을 직접
          입력하며, 숙련도 표의 추가 확률만 자동으로 더합니다.
        </p>
        <p className="save">
          95%·99%는 모형의 평균 신뢰구간이나 실제 게임 보장이 아닙니다. 선택한 생산 범위·균등 기본
          분포·최대 프로크 방식·독립 묶음 가정이 맞을 때의 Hoeffding 하한입니다. 여러 제작 단계에는
          실패 위험을 나눠 배분합니다. 대량 생산의 묶음 상관까지 보수적으로 취급하므로 실제 필요한
          양보다 많을 수 있습니다.
        </p>
        <p className="save">
          제작 계획 표에서 재료별 계산 모형과 생산 범위를 선택해야 적용됩니다. 특제·부산물·1개 고정
          제작식에 일반 1~4 모형을 일괄 적용하지 않습니다. 수동 평균만 지정한 항목에는 확률 하한을
          계산하지 않습니다.
        </p>
        <a href={tables.officialSource} target="_blank" rel="noreferrer">
          공식 숙련도·대량 가공 표
        </a>{' '}
        ·{' '}
        <a href={tables.source} target="_blank" rel="noreferrer">
          Codex 숙련도 표
        </a>
        <p className="save">조회: {new Date(tables.checkedAt).toLocaleString('ko-KR')}</p>
      </section>
    </section>
  )
}
