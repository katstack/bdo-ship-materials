import type { Hull, Ship } from '../types'
import { defaultCarrackTargetForHull, defaultEquipmentOrder, hullLabel } from '../catalog'
export const newShip = (hull: Hull): Ship => ({
  id: crypto.randomUUID(),
  name: `${hullLabel[hull]} ${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`,
  hull,
  activeStage:
    hull === 'balance' || hull === 'advance' || hull === 'volante' || hull === 'valor' ? 3 : 1,
  upgradeHull: defaultCarrackTargetForHull(hull),
  equipmentOrder: [...defaultEquipmentOrder[hull]],
})
