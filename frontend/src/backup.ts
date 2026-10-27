import type {
  Budget,
  Goal,
  GoalContribution,
  MoneySource,
  MochiPointsRecord,
  Task,
  Transaction,
} from './db'

export const backupPreferenceKeys = [
  'mochi-background-color',
  'mochi-outfit',
  'mochi-money-source-types',
  'mochi-category-options',
  'mochi-frequent-category-options',
] as const

export type BackupPreferenceKey = typeof backupPreferenceKeys[number]

export interface MochiBackup {
  format: 'mochi-backup'
  version: 1
  exportedAt: string
  tables: {
    transactions: Transaction[]
    budgets: Budget[]
    goals: Goal[]
    goalContributions: GoalContribution[]
    tasks: Task[]
    moneySources: MoneySource[]
    points: MochiPointsRecord[]
  }
  preferences: Record<BackupPreferenceKey, string | null>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0

const isSafeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value)

const isOptional = (record: Record<string, unknown>, key: string, predicate: (value: unknown) => boolean) =>
  !(key in record) || predicate(record[key])

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

const isDateKey = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00`))

const isTransaction = (value: unknown): value is Transaction => {
  if (!isRecord(value)) return false
  return isId(value.id) &&
    ['income', 'expense', 'borrow', 'repay', 'lend', 'collect', 'cardPayment'].includes(String(value.type)) &&
    isSafeInteger(value.amount) && value.amount > 0 &&
    typeof value.category === 'string' &&
    isDateKey(value.date) &&
    isOptional(value, 'note', (item) => typeof item === 'string') &&
    isOptional(value, 'sourceId', isId) &&
    isOptional(value, 'relatedSourceId', isId) &&
    isOptional(value, 'counterparty', (item) => typeof item === 'string') &&
    isOptional(value, 'isOpeningBalance', (item) => typeof item === 'boolean')
}

const isBudget = (value: unknown): value is Budget => {
  if (!isRecord(value)) return false
  return isId(value.id) &&
    typeof value.category === 'string' &&
    isOptional(value, 'subcategories', isStringArray) &&
    isSafeInteger(value.limit) && value.limit >= 0 &&
    typeof value.month === 'string' && /^\d{4}-\d{2}$/.test(value.month)
}

const isGoal = (value: unknown): value is Goal => {
  if (!isRecord(value)) return false
  return isId(value.id) &&
    typeof value.name === 'string' &&
    isSafeInteger(value.targetAmount) && value.targetAmount > 0 &&
    isSafeInteger(value.savedAmount) && value.savedAmount >= 0 &&
    typeof value.deadline === 'string' &&
    isOptional(value, 'taskRewarded', (item) => typeof item === 'boolean')
}

const isGoalContribution = (value: unknown): value is GoalContribution => {
  if (!isRecord(value)) return false
  return isId(value.id) &&
    isId(value.goalId) &&
    isSafeInteger(value.amount) && value.amount > 0 &&
    isDateKey(value.date) &&
    isId(value.sourceId) &&
    isId(value.transactionId)
}

const isTask = (value: unknown): value is Task => {
  if (!isRecord(value)) return false
  return isId(value.id) &&
    typeof value.title === 'string' &&
    typeof value.completed === 'boolean' &&
    isSafeInteger(value.reward) && value.reward > 0 &&
    isDateKey(value.date) &&
    isOptional(value, 'completedAt', (item) => typeof item === 'string') &&
    isOptional(value, 'goalId', isId)
}

const isMoneySource = (value: unknown): value is MoneySource => {
  if (!isRecord(value)) return false
  return isId(value.id) &&
    typeof value.name === 'string' &&
    typeof value.type === 'string' &&
    isOptional(value, 'financialKind', (item) => ['income', 'expense', 'debt', 'lent'].includes(String(item))) &&
    isSafeInteger(value.initialBalance) &&
    isOptional(value, 'balanceMode', (item) => item === 'asset' || item === 'debt') &&
    isOptional(value, 'creditLimit', (item) => isSafeInteger(item) && item >= 0) &&
    isOptional(value, 'includeInTotal', (item) => typeof item === 'boolean') &&
    isOptional(value, 'openingBalanceTransactionId', isId)
}

const isMochiPointsRecord = (value: unknown): value is MochiPointsRecord => {
  if (!isRecord(value)) return false
  return isId(value.id) &&
    isSafeInteger(value.total) && value.total >= 0 &&
    isOptional(value, 'unlockedAccessories', isStringArray) &&
    isOptional(value, 'checkInDates', isStringArray) &&
    isOptional(value, 'categorySetupCompleted', (item) => typeof item === 'boolean') &&
    isOptional(value, 'onboardingEnabled', (item) => typeof item === 'boolean') &&
    isOptional(value, 'onboardingCompletedPages', isStringArray)
}

const isArrayOf = <T>(value: unknown, predicate: (item: unknown) => item is T): value is T[] =>
  Array.isArray(value) && value.every(predicate)

const hasUniqueIds = (records: Array<{ id?: number }>) =>
  new Set(records.map((record) => record.id)).size === records.length

export const parseMochiBackup = (value: unknown): MochiBackup => {
  if (!isRecord(value) || value.format !== 'mochi-backup' || value.version !== 1 ||
    typeof value.exportedAt !== 'string' || !isRecord(value.tables) || !isRecord(value.preferences)) {
    throw new Error('Tệp không đúng định dạng sao lưu Mochi.')
  }

  const { tables, preferences } = value
  if (!isArrayOf(tables.transactions, isTransaction) ||
    !isArrayOf(tables.budgets, isBudget) ||
    !isArrayOf(tables.goals, isGoal) ||
    !isArrayOf(tables.goalContributions, isGoalContribution) ||
    !isArrayOf(tables.tasks, isTask) ||
    !isArrayOf(tables.moneySources, isMoneySource) ||
    !isArrayOf(tables.points, isMochiPointsRecord) ||
    !backupPreferenceKeys.every((key) => key in preferences &&
      (preferences[key] === null || typeof preferences[key] === 'string')) ||
    !Object.keys(preferences).every((key) => backupPreferenceKeys.includes(key as BackupPreferenceKey))) {
    throw new Error('Tệp sao lưu chứa dữ liệu không hợp lệ hoặc không đầy đủ.')
  }

  const records = [
    tables.transactions,
    tables.budgets,
    tables.goals,
    tables.goalContributions,
    tables.tasks,
    tables.moneySources,
    tables.points,
  ]
  if (!records.every(hasUniqueIds)) {
    throw new Error('Tệp sao lưu có mã dữ liệu bị trùng.')
  }

  return {
    format: 'mochi-backup',
    version: 1,
    exportedAt: value.exportedAt,
    tables: {
      transactions: tables.transactions,
      budgets: tables.budgets,
      goals: tables.goals,
      goalContributions: tables.goalContributions,
      tasks: tables.tasks,
      moneySources: tables.moneySources,
      points: tables.points,
    },
    preferences: Object.fromEntries(
      backupPreferenceKeys.map((key) => [key, preferences[key]]),
    ) as MochiBackup['preferences'],
  }
}
