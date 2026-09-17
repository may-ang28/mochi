import Dexie, { type Table } from 'dexie'

export interface Transaction {
  id?: number
  type: 'income' | 'expense'
  amount: number
  category: string
  note?: string
  date: string
  sourceId?: number
}

export interface MoneySource {
  id?: number
  name: string
  type: string
  initialBalance: number
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
}

export interface Task {
  id?: number
  title: string
  completed: boolean
  reward: number
  date: string
}

export class MochiDB extends Dexie {
  transactions!: Table<Transaction, number>
  budgets!: Table<Budget, number>
  goals!: Table<Goal, number>
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
  }
}

export const db = new MochiDB()