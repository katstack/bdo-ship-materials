import sources from '../data/masterySources.json'

export const masteryEvidence = sources

/**
 * Client curves are threshold/value tables, not a proven continuous formula.
 * Evidence and the exact numeric provenance live in masterySources.json.
 * Use the greatest threshold <= mastery; clamp at table ends, never interpolate.
 */
export function lookupMasteryBracket<T extends { mastery: number }>(
  rows: readonly T[],
  mastery: number,
): T {
  if (!rows.length) throw new Error('숙련도 구간표가 비어 있습니다.')
  if (!Number.isFinite(mastery)) throw new Error('숙련도는 유한한 숫자여야 합니다.')
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].mastery <= mastery) return rows[i]
  }
  return rows[0]
}
