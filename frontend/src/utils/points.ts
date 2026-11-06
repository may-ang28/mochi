import type { MochiPointHistoryEntry, MochiPointsRecord } from '../db'

export const adjustMochiPoints = (
  record: MochiPointsRecord | undefined,
  amount: number,
  reason: string,
): MochiPointsRecord => {
  const total = record?.total ?? 0
  const nextTotal = Math.max(0, total + amount)
  const createdAt = new Date().toISOString()
  const history = record?.pointHistory ?? []
  const entry: MochiPointHistoryEntry = {
    id: `${createdAt}-${history.length}`,
    amount: nextTotal - total,
    reason,
    createdAt,
  }

  return {
    ...record,
    id: 1,
    total: nextTotal,
    unlockedAccessories: record?.unlockedAccessories ?? [],
    pointHistory: [...history, entry],
  }
}
