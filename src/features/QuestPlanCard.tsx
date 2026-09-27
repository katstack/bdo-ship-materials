import { materialById } from '../catalog'
import { codexQuestUrl } from '../data/codex'
import type { DailyTask, SupplyPlan } from '../types'
import { number } from '../utils'

type QuestPlanCardProps = {
  task: DailyTask
  plan?: SupplyPlan
  onPlan: (task: DailyTask, patch: { enabled?: boolean; choiceId?: string }) => void
  routeManaged?: boolean
}

export function QuestPlanCard({ task, plan, onPlan, routeManaged = false }: QuestPlanCardProps) {
  return (
    <article
      className={`task-card ${plan?.enabled ? 'planned' : ''}`}
      data-quest-id={task.codexQuestId}
    >
      <span className={`period ${task.period}`}>{task.period === 'daily' ? '일일' : '주간'}</span>
      <h3>{task.name}</h3>
      <p>{task.objective || task.note}</p>
      <small className="quest-meta">
        {task.codexQuestId} ·{' '}
        <a
          href={task.codexQuestId ? codexQuestUrl(task.codexQuestId) : undefined}
          target="_blank"
          rel="noreferrer"
        >
          BDO Codex
        </a>
      </small>
      <div className="rewards">
        {task.rewards.map((reward) => (
          <span key={reward.materialId}>
            +{number(reward.quantity)} {materialById[reward.materialId].name}
          </span>
        ))}
      </div>
      {task.choices && (
        <label className="quest-choice">
          선택 보상
          <select
            value={plan?.choiceId || ''}
            onChange={(event) => onPlan(task, { choiceId: event.target.value })}
          >
            <option value="">선택하세요</option>
            {task.choices.map((choice) => (
              <option key={choice.id} value={choice.id}>
                {choice.label} ·{' '}
                {choice.rewards
                  .map(
                    (reward) =>
                      `${number(reward.quantity)} ${materialById[reward.materialId].name}`,
                  )
                  .join(', ')}
              </option>
            ))}
          </select>
        </label>
      )}
      {routeManaged && (
        <small>위에서 수행 루트를 고른 뒤, 이 의뢰를 수급 계획에 따로 포함할 수 있습니다.</small>
      )}
      <button
        className={plan?.enabled ? 'planned-button' : 'primary'}
        onClick={() => onPlan(task, { enabled: !plan?.enabled })}
      >
        {plan?.enabled ? '수급 계획에서 제외' : '수급 계획에 포함'}
      </button>
      <small>
        {plan?.enabled
          ? task.choices && !plan?.choiceId
            ? '기본 보상만 계산 중입니다. 선택 보상도 지정하세요.'
            : '재료별 일일·주간 수급량과 완료 예상에 반영됩니다.'
          : '재고에는 영향을 주지 않으며, 수급 예상에도 포함되지 않습니다.'}
      </small>
    </article>
  )
}
