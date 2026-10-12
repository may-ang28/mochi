import Dexie, { type Table } from 'dexie'

export interface Transaction {
  id?: number
  type: 'income' | 'expense'
  amount: number
  category: string
  note?: string
  date: string
  sourceId?: number
  isOpeningBalance?: boolean
}

export interface MoneySource {
  id?: number
  name: string
  type: string
  initialBalance: number
  openingBalanceTransactionId?: number
}

export interface Budget {
  id?: number
  category: string
  limit: number
  month: string
}

export interface Goal {
  id?: number
  name: string
  targetAmount: number
  savedAmount: number
  deadline: string
  taskRewarded?: boolean
}

export interface GoalContribution {
  id?: number
  goalId: number
  amount: number
  date: string
  sourceId: number
  transactionId: number
}

export interface Task {
  id?: number
  title: string
  completed: boolean
  reward: number
  date: string
  completedAt?: string
  goalId?: number
}

export class MochiDB extends Dexie {
  transactions!: Table<Transaction, number>
  budgets!: Table<Budget, number>
  goals!: Table<Goal, number>
  goalContributions!: Table<GoalContribution, number>
  tasks!: Table<Task, number>
  moneySources!: Table<MoneySource, number>
  points!: Table<{ id?: number; total: number }, number>

  constructor() {
    super('MochiDB')

    this.version(2).stores({
      transactions: '++id, type, category, date',
      budgets: '++id, category, month',
      goals: '++id, name, deadline',
      tasks: '++id, completed, date',
      points: '++id',
    })

    this.version(3).stores({
      transactions: '++id, type, category, date, sourceId',
      budgets: '++id, category, month',
      goals: '++id, name, deadline',
      tasks: '++id, completed, date',
      moneySources: '++id, name',
      points: '++id',
    })

    this.version(4).stores({
      transactions: '++id, type, category, date, sourceId',
      budgets: '++id, category, month',
      goals: '++id, name, deadline',
      goalContributions: '++id, goalId, date, sourceId, transactionId',
      tasks: '++id, completed, date',
      moneySources: '++id, name',
      points: '++id',
    })

    this.version(5).stores({
      transactions: '++id, type, category, date, sourceId',
      budgets: '++id, category, month',
      goals: '++id, name, deadline',
      goalContributions: '++id, goalId, date, sourceId, transactionId',
      tasks: '++id, completed, date',
      moneySources: '++id, name',
      points: '++id',
    }).upgrade(async (transaction) => {
      const contributions = transaction.table('goalContributions')
      if (await contributions.count() > 0) return

      const [goals, expenses] = await Promise.all([
        transaction.table('goals').toArray(),
        transaction.table('transactions').where('category').equals('Tiết kiệm').toArray(),
      ])
      const migratedContributions = expenses.flatMap((expense) => {
        const matchingGoals = goals.filter((goal) =>
          expense.note === `Tiết kiệm cho mục tiêu: ${goal.name}`,
        )
        const goal = matchingGoals.length === 1 ? matchingGoals[0] : undefined
        if (!goal || goal.id === undefined || expense.id === undefined || expense.sourceId === undefined) {
          return []
        }
        return [{
          goalId: goal.id,
          amount: expense.amount,
          date: expense.date,
          sourceId: expense.sourceId,
          transactionId: expense.id,
        }]
      })

      if (migratedContributions.length > 0) {
        await contributions.bulkAdd(migratedContributions)
      }
    })
  }
}

export const db = new MochiDB()