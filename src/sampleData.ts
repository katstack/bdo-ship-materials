import type { AppData } from './types'
import { defaultEquipmentOrder } from './catalog'

export const sampleData: AppData = {
  version: 2,
  updatedAt: new Date().toISOString(),
  materialSort: { key: 'crowCoinTotal', direction: 'desc' },
  materialExchangeSort: { key: 'priority', direction: 'desc' },
  barterSession: { remainingNegotiation: 0, costPerExchange: 0, exchangeCounts: {}, addToInventory: true },
  completedTasks: {},
  supplyPlans: {},
  inventory: { enhanced: 70, seaweed: 90, steel: 12, low: 35, reef: 44, pearl: 14, moon: 1160, wave: 37, high: 9, cobalt: 0, rock: 49, combat: 60, flax: 60, 'deep-tide': 77, 'brilliant-salt': 2, tear: 19 },
  ships: [{ id: 'trade-a', name: '무역선 A', hull: 'trade', activeStage: 2, upgradeHull: 'advance', equipmentOrder: defaultEquipmentOrder.trade }, { id: 'advance-a', name: '중범선 점진 A', hull: 'advance', activeStage: 3, equipmentOrder: defaultEquipmentOrder.advance }]
}
