import { useEffect, useState } from 'react'
import { db, type Budget, type Goal, type GoalContribution, type MochiPointsRecord, type MoneySource, type Task, type Transaction } from '../db'

type DataLoadedHandler = (
  transactions: Transaction[],
  points: MochiPointsRecord | undefined,
) => Promise<void>

export function useMochiData(
  username: string | null,
  initialLoading: boolean,
  onDataLoaded: DataLoadedHandler,
  onError: (message: string) => void,
) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [goalContributions, setGoalContributions] = useState<GoalContribution[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [moneySources, setMoneySources] = useState<MoneySource[]>([])
  const [isDataLoading, setIsDataLoading] = useState(initialLoading)

  useEffect(() => {
    if (!username) return
    let active = true
    setIsDataLoading(true)

    const loadData = async () => {
      try {
        const [allTransactions, allBudgets, allGoals, allGoalContributions, allTasks, allMoneySources, savedPoints] =
          await Promise.all([
            db.transactions.toArray(),
            db.budgets.toArray(),
            db.goals.toArray(),
            db.goalContributions.toArray(),
            db.tasks.toArray(),
            db.moneySources.toArray(),
            db.points.get(1),
          ])

        if (!active) return
        setTransactions(allTransactions)
        setBudgets(allBudgets)
        setGoals(allGoals)
        setGoalContributions(allGoalContributions)
        setTasks(allTasks)
        setMoneySources(allMoneySources)
        await onDataLoaded(allTransactions, savedPoints)
      } catch (loadError) {
        if (active) {
          onError(loadError instanceof Error ? loadError.message : 'Không thể tải dữ liệu.')
        }
      } finally {
        if (active) setIsDataLoading(false)
      }
    }

    void loadData()
    return () => { active = false }
  }, [onDataLoaded, onError, username])

  const refreshTransactions = async () => setTransactions(await db.transactions.toArray())
  const refreshBudgets = async () => setBudgets(await db.budgets.toArray())
  const refreshGoals = async () => setGoals(await db.goals.toArray())
  const refreshGoalContributions = async () => setGoalContributions(await db.goalContributions.toArray())
  const refreshTasks = async () => setTasks(await db.tasks.toArray())
  const refreshMoneySources = async () => setMoneySources(await db.moneySources.toArray())

  useEffect(() => {
    if (!username) return
    const completedTasks = tasks.filter((task) => task.completed && task.id !== undefined)
    if (completedTasks.length === 0) return

    const taskExpiry = (task: Task) => Date.parse(task.completedAt ?? `${task.date}T23:59:59`) + 3 * 24 * 60 * 60 * 1000
    const nextExpiry = Math.min(...completedTasks.map(taskExpiry))
    const timer = window.setTimeout(() => {
      const expiredIds = completedTasks
        .filter((task) => taskExpiry(task) <= Date.now())
        .map((task) => task.id!)
      if (expiredIds.length === 0) return
      void db.tasks.bulkDelete(expiredIds).then(async () => setTasks(await db.tasks.toArray())).catch((taskError: unknown) => {
        onError(taskError instanceof Error ? taskError.message : 'Không thể xóa nhiệm vụ đã hết hạn.')
      })
    }, Math.max(0, nextExpiry - Date.now()))

    return () => window.clearTimeout(timer)
  }, [onError, tasks, username])

  return {
    transactions,
    budgets,
    goals,
    goalContributions,
    tasks,
    moneySources,
    isDataLoading,
    setIsDataLoading,
    refreshTransactions,
    refreshBudgets,
    refreshGoals,
    refreshGoalContributions,
    refreshTasks,
    refreshMoneySources,
  }
}
