import { dailyTasks } from '../catalog'
import type { AppData, MaterialSupply, SupplyContribution } from '../types'

export function materialSupply(data: AppData, materialId: string): MaterialSupply {
  const result: MaterialSupply = { daily: 0, weekly: 0, dailySources: [], weeklySources: [] }
  dailyTasks.forEach((task) => {
    const plan = data.supplyPlans[task.id]
    if (!plan?.enabled) return
    const selectedChoice = task.choices?.find((choice) => choice.id === plan.choiceId)
    const rewards = [...task.rewards, ...(selectedChoice?.rewards || [])]
    const quantity = rewards
      .filter((reward) => reward.materialId === materialId)
      .reduce((sum, reward) => sum + reward.quantity, 0)
    if (!quantity) return
    const contribution: SupplyContribution = {
      taskId: task.id,
      taskName: task.name,
      quantity,
      period: task.period,
    }
    if (task.period === 'daily') {
      result.daily += quantity
      result.dailySources.push(contribution)
    } else {
      result.weekly += quantity
      result.weeklySources.push(contribution)
    }
  })
  return result
}

export const estimatedSupplyDays = (shortage: number, daily: number, weekly: number) => {
  const averageDaily = daily + weekly / 7
  return shortage > 0 && averageDaily > 0 ? Math.ceil(shortage / averageDaily) : undefined
}
