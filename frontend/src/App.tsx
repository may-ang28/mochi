import { useEffect, useState, type FormEvent } from 'react'
import {
  db,
  type Budget,
  type Goal,
  type GoalContribution,
  type MoneySource,
  type Task,
  type Transaction,
} from './db'
import AssistantWidget from './AssistantWidget'
import {
  createLocalAccount,
  getLocalAccount,
  getSignedInUsername,
  signInLocalAccount,
  signOutLocalAccount,
} from './auth'
import './App.css'

type Page = 'home' | 'budgets' | 'goals' | 'tasks' | 'transactions' | 'sources' | 'settings'

const navigation: { id: Page; label: string; icon: string; description: string }[] = [
  { id: 'budgets', label: 'Ngân sách', icon: '💰', description: 'Theo dõi hạn mức chi tiêu' },
  { id: 'goals', label: 'Mục tiêu', icon: '🎯', description: 'Lên kế hoạch tiết kiệm' },
  { id: 'tasks', label: 'Nhiệm vụ', icon: '📝', description: 'Hoàn thành việc nhỏ mỗi ngày' },
  { id: 'transactions', label: 'Giao dịch', icon: '💳', description: 'Quản lý thu nhập và chi tiêu' },
  { id: 'sources', label: 'Nguồn tiền', icon: '👛', description: 'Theo dõi số dư từng nguồn tiền' },
  { id: 'settings', label: 'Cài đặt', icon: '⚙️', description: 'Tài khoản và dữ liệu ứng dụng' },
]

const today = () => new Date().toISOString().slice(0, 10)
const currentMonth = () => new Date().toISOString().slice(0, 7)
const formatMoney = (amount: number) => `${amount.toLocaleString('vi-VN')}đ`
const BACKGROUND_COLOR_KEY = 'mochi-background-color'
const pastelBackgrounds = [
  { label: 'Hồng Mochi', value: '#fce7f3' },
  { label: 'Xanh bạc hà', value: '#e8f5ed' },
  { label: 'Tím lavender', value: '#f0ebf8' },
  { label: 'Đào nhạt', value: '#fff0e6' },
  { label: 'Xanh trời', value: '#e7f2fa' },
]
const getInitialBackgroundColor = () => {
  try {
    const savedColor = localStorage.getItem(BACKGROUND_COLOR_KEY)
    return pastelBackgrounds.find((option) => option.value === savedColor)?.value ?? pastelBackgrounds[0].value
  } catch {
    return pastelBackgrounds[0].value
  }
}
const defaultMoneySourceTypes = [
  'Tiền mặt',
  'Tài khoản ngân hàng',
  'Thẻ',
  'Thẻ tín dụng',
  'Thẻ ghi nợ',
  'Thẻ trả trước',
  'Ví điện tử',
]

function App() {
  const [storedAuth] = useState<{
    username: string | null
    hasLocalAccount: boolean
    mode: 'signup' | 'signin'
    error: string
  }>(() => {
    try {
      const account = getLocalAccount()
      const signedInUsername = getSignedInUsername()
      if (account && signedInUsername === account.username) {
        return { username: account.username, hasLocalAccount: true, mode: 'signin', error: '' }
      }
      signOutLocalAccount()
      return {
        username: null,
        hasLocalAccount: account !== null,
        mode: account ? 'signin' : 'signup',
        error: '',
      }
    } catch (authLoadError) {
      return {
        username: null,
        hasLocalAccount: false,
        mode: 'signup',
        error: authLoadError instanceof Error ? authLoadError.message : 'Không thể đọc hồ sơ.',
      }
    }
  })
  const [username, setUsername] = useState<string | null>(storedAuth.username)
  const [hasLocalAccount, setHasLocalAccount] = useState(storedAuth.hasLocalAccount)
  const [authMode, setAuthMode] = useState<'signup' | 'signin'>(storedAuth.mode)
  const [authName, setAuthName] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState(storedAuth.error)
  const [page, setPage] = useState<Page>('home')
  const [backgroundColor, setBackgroundColor] = useState(getInitialBackgroundColor)
  const [menuOpen, setMenuOpen] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [goalContributions, setGoalContributions] = useState<GoalContribution[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [moneySources, setMoneySources] = useState<MoneySource[]>([])
  const [mochiPoints, setMochiPoints] = useState(0)
  const [error, setError] = useState('')
  const [isDataLoading, setIsDataLoading] = useState(storedAuth.username !== null)

  const [transactionType, setTransactionType] = useState<'income' | 'expense'>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(today())
  const [transactionSourceId, setTransactionSourceId] = useState('')
  const [editingTransactionId, setEditingTransactionId] = useState<number | null>(null)

  const [sourceName, setSourceName] = useState('')
  const [sourceType, setSourceType] = useState('')
  const [sourceInitialBalance, setSourceInitialBalance] = useState('')
  const [editingSourceId, setEditingSourceId] = useState<number | null>(null)

  const [budgetCategory, setBudgetCategory] = useState('')
  const [budgetLimit, setBudgetLimit] = useState('')
  const [budgetMonth, setBudgetMonth] = useState(currentMonth())
  const [editingBudgetId, setEditingBudgetId] = useState<number | null>(null)

  const [goalName, setGoalName] = useState('')
  const [goalTargetAmount, setGoalTargetAmount] = useState('')
  const [goalSavedAmount, setGoalSavedAmount] = useState('')
  const [goalDeadline, setGoalDeadline] = useState('')
  const [editingGoalId, setEditingGoalId] = useState<number | null>(null)
  const [savingGoalId, setSavingGoalId] = useState<number | null>(null)
  const [savingAmount, setSavingAmount] = useState('')
  const [savingDate, setSavingDate] = useState(today())
  const [savingSourceId, setSavingSourceId] = useState('')
  const [editingContributionId, setEditingContributionId] = useState<number | null>(null)

  useEffect(() => {
    if (!username) return
    let active = true

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
        setMochiPoints(savedPoints?.total ?? 0)
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Không thể tải dữ liệu.')
        }
      } finally {
        if (active) setIsDataLoading(false)
      }
    }

    void loadData()
    return () => { active = false }
  }, [username])

  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAuthError('')
    setAuthBusy(true)

    try {
      if (authMode === 'signup') {
        const normalizedName = authName.trim()
        if (!/^[\p{L}\p{N} ._'’-]{2,30}$/u.test(normalizedName)) {
          throw new Error('Tên cần dài 2–30 ký tự; chỉ dùng chữ, số, dấu cách hoặc . _ \' -')
        }
        if (authPassword.length < 8 || authPassword.length > 128) {
          throw new Error('Mật khẩu cần có từ 8 đến 128 ký tự.')
        }
        await createLocalAccount(normalizedName, authPassword)
        setHasLocalAccount(true)
        setIsDataLoading(true)
        setUsername(normalizedName)
      } else {
        if (authPassword.length > 128) {
          throw new Error('Mật khẩu không được dài quá 128 ký tự.')
        }
        const signedInUsername = await signInLocalAccount(authPassword)
        setIsDataLoading(true)
        setUsername(signedInUsername)
      }
      setAuthPassword('')
    } catch (submitError) {
      setAuthError(submitError instanceof Error ? submitError.message : 'Không thể đăng nhập. Vui lòng thử lại.')
    } finally {
      setAuthBusy(false)
    }
  }

  const signOut = () => {
    signOutLocalAccount()
    setUsername(null)
    setPage('home')
    setMenuOpen(false)
    setAuthPassword('')
    setAuthError('')
  }

  const refreshTransactions = async () => setTransactions(await db.transactions.toArray())
  const refreshBudgets = async () => setBudgets(await db.budgets.toArray())
  const refreshGoals = async () => setGoals(await db.goals.toArray())
  const refreshGoalContributions = async () => setGoalContributions(await db.goalContributions.toArray())
  const refreshTasks = async () => setTasks(await db.tasks.toArray())
  const refreshMoneySources = async () => setMoneySources(await db.moneySources.toArray())

  const runAction = async (action: () => Promise<void>) => {
    setError('')
    try {
      await action()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Đã xảy ra lỗi. Vui lòng thử lại.')
    }
  }

  const updateBackgroundColor = (color: string) => {
    if (!pastelBackgrounds.some((option) => option.value === color)) return
    setBackgroundColor(color)
    try {
      localStorage.setItem(BACKGROUND_COLOR_KEY, color)
    } catch {
      setError('Không thể lưu màu nền trên thiết bị này.')
    }
  }

  const saveTransaction = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void runAction(async () => {
      const transaction = {
        type: transactionType,
        amount: Number(amount),
        category: category.trim(),
        note: note.trim(),
        date,
        sourceId: Number(transactionSourceId),
      }

      if (!transactionSourceId || !moneySources.some((source) => source.id === Number(transactionSourceId))) {
        throw new Error('Hãy chọn một nguồn tiền hợp lệ cho giao dịch.')
      }

      if (editingTransactionId === null) {
        await db.transactions.add(transaction)
      } else {
        await db.transactions.update(editingTransactionId, transaction)
      }
      await refreshTransactions()
      setEditingTransactionId(null)
      setAmount('')
      setCategory('')
      setNote('')
      setDate(today())
      setTransactionSourceId('')
    })
  }

  const editTransaction = (transaction: Transaction) => {
    setEditingTransactionId(transaction.id ?? null)
    setTransactionType(transaction.type)
    setAmount(String(transaction.amount))
    setCategory(transaction.category)
    setNote(transaction.note ?? '')
    setDate(transaction.date)
    setTransactionSourceId(transaction.sourceId === undefined ? '' : String(transaction.sourceId))
  }

  const deleteTransaction = (id: number) => {
    void runAction(async () => {
      await db.transactions.delete(id)
      await refreshTransactions()
    })
  }

  const saveMoneySource = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void runAction(async () => {
      const source = {
        name: sourceName.trim(),
        type: sourceType.trim(),
        initialBalance: Number(sourceInitialBalance),
      }
      let createdSourceId: number | undefined

      await db.transaction('rw', db.moneySources, db.transactions, async () => {
        if (editingSourceId === null) {
          createdSourceId = await db.moneySources.add(source)
          if (source.initialBalance > 0) {
            const openingBalanceTransactionId = await db.transactions.add({
              type: 'income',
              amount: source.initialBalance,
              category: 'Số dư ban đầu',
              note: `Số dư ban đầu · ${source.name}`,
              date: today(),
              sourceId: createdSourceId,
              isOpeningBalance: true,
            })
            await db.moneySources.update(createdSourceId, { openingBalanceTransactionId })
          }
        } else {
          const existingSource = await db.moneySources.get(editingSourceId)
          if (!existingSource) throw new Error('Không tìm thấy nguồn tiền.')

          let openingBalanceTransactionId = existingSource.openingBalanceTransactionId
          if (source.initialBalance > 0) {
            const openingBalance = {
              type: 'income' as const,
              amount: source.initialBalance,
              category: 'Số dư ban đầu',
              note: `Số dư ban đầu · ${source.name}`,
              date: today(),
              sourceId: editingSourceId,
              isOpeningBalance: true,
            }
            if (openingBalanceTransactionId === undefined) {
              openingBalanceTransactionId = await db.transactions.add(openingBalance)
            } else {
              await db.transactions.update(openingBalanceTransactionId, openingBalance)
            }
          } else if (openingBalanceTransactionId !== undefined) {
            await db.transactions.delete(openingBalanceTransactionId)
            openingBalanceTransactionId = undefined
          }

          await db.moneySources.put({
            ...source,
            id: editingSourceId,
            ...(openingBalanceTransactionId === undefined ? {} : { openingBalanceTransactionId }),
          })
        }
      })

      if (createdSourceId !== undefined) setTransactionSourceId(String(createdSourceId))
      await Promise.all([refreshMoneySources(), refreshTransactions()])
      setEditingSourceId(null)
      setSourceName('')
      setSourceType('')
      setSourceInitialBalance('')
    })
  }

  const editMoneySource = (source: MoneySource) => {
    setEditingSourceId(source.id ?? null)
    setSourceName(source.name)
    setSourceType(source.type)
    setSourceInitialBalance(String(source.initialBalance))
  }

  const deleteMoneySource = (id: number) => {
    void runAction(async () => {
      const linkedTransactions = await db.transactions.where('sourceId').equals(id).toArray()
      if (linkedTransactions.some((transaction) => !transaction.isOpeningBalance)) {
        throw new Error('Không thể xóa nguồn tiền đã có giao dịch. Hãy giữ lại để bảo toàn lịch sử số dư.')
      }

      await db.transaction('rw', db.moneySources, db.transactions, async () => {
        await db.transactions.bulkDelete(linkedTransactions.map((transaction) => transaction.id!))
        await db.moneySources.delete(id)
      })
      await Promise.all([refreshMoneySources(), refreshTransactions()])
      if (transactionSourceId === String(id)) setTransactionSourceId('')
    })
  }

  const saveBudget = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void runAction(async () => {
      const budget = { category: budgetCategory.trim(), limit: Number(budgetLimit), month: budgetMonth }
      if (editingBudgetId === null) {
        await db.budgets.add(budget)
      } else {
        await db.budgets.update(editingBudgetId, budget)
      }
      await refreshBudgets()
      setEditingBudgetId(null)
      setBudgetCategory('')
      setBudgetLimit('')
    })
  }

  const deleteBudget = (id: number) => {
    void runAction(async () => {
      await db.budgets.delete(id)
      await refreshBudgets()
    })
  }

  const saveGoal = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void runAction(async () => {
      const goal = {
        name: goalName.trim(),
        targetAmount: Number(goalTargetAmount),
        savedAmount: Number(goalSavedAmount) || 0,
        deadline: goalDeadline,
      }
      if (editingGoalId === null) {
        await db.goals.add(goal)
      } else {
        const existingGoal = goals.find((item) => item.id === editingGoalId)
        await db.goals.update(editingGoalId, {
          ...goal,
          savedAmount: existingGoal?.savedAmount ?? goal.savedAmount,
        })
      }
      await refreshGoals()
      setEditingGoalId(null)
      setGoalName('')
      setGoalTargetAmount('')
      setGoalSavedAmount('')
      setGoalDeadline('')
    })
  }

  const editGoal = (goal: Goal) => {
    setEditingGoalId(goal.id ?? null)
    setGoalName(goal.name)
    setGoalTargetAmount(String(goal.targetAmount))
    setGoalSavedAmount(String(goal.savedAmount))
    setGoalDeadline(goal.deadline)
  }

  const deleteGoal = (id: number) => {
    void runAction(async () => {
      await db.transaction('rw', db.goals, db.goalContributions, async () => {
        await db.goalContributions.where('goalId').equals(id).delete()
        await db.goals.delete(id)
      })
      await Promise.all([refreshGoals(), refreshGoalContributions()])
    })
  }

  const saveGoalContribution = (event: FormEvent<HTMLFormElement>, goalId: number) => {
    event.preventDefault()
    void runAction(async () => {
      const value = Number(savingAmount)
      if (!Number.isSafeInteger(value) || value <= 0) {
        throw new Error('Số tiền cần là số nguyên lớn hơn 0.')
      }
      if (!savingDate) throw new Error('Hãy chọn ngày thêm tiền.')
      const sourceId = Number(savingSourceId)
      if (!moneySources.some((source) => source.id === sourceId)) {
        throw new Error('Hãy chọn một nguồn tiền hợp lệ cho khoản tiết kiệm.')
      }

      await db.transaction('rw', db.goals, db.goalContributions, db.transactions, async () => {
        const goal = await db.goals.get(goalId)
        if (!goal) throw new Error('Không tìm thấy mục tiêu tiết kiệm.')

        const transaction = {
          type: 'expense',
          amount: value,
          category: 'Tiết kiệm',
          note: `Tiết kiệm cho mục tiêu: ${goal.name}`,
          date: savingDate,
          sourceId,
        } as const

        if (editingContributionId === null) {
          const transactionId = await db.transactions.add(transaction)
          await db.goalContributions.add({ goalId, amount: value, date: savingDate, sourceId, transactionId })
          await db.goals.update(goalId, { savedAmount: goal.savedAmount + value })
        } else {
          const contribution = await db.goalContributions.get(editingContributionId)
          if (!contribution || contribution.goalId !== goalId) {
            throw new Error('Không tìm thấy lần thêm tiền cần chỉnh sửa.')
          }

          let transactionId = contribution.transactionId
          if (await db.transactions.update(transactionId, transaction) === 0) {
            transactionId = await db.transactions.add(transaction)
          }
          await db.goalContributions.update(editingContributionId, {
            amount: value,
            date: savingDate,
            sourceId,
            transactionId,
          })
          await db.goals.update(goalId, { savedAmount: goal.savedAmount - contribution.amount + value })
        }
      })
      await Promise.all([refreshGoals(), refreshGoalContributions(), refreshTransactions()])
      setSavingGoalId(null)
      setEditingContributionId(null)
      setSavingAmount('')
      setSavingDate(today())
      setSavingSourceId('')
    })
  }

  const editGoalContribution = (contribution: GoalContribution) => {
    setSavingGoalId(contribution.goalId)
    setEditingContributionId(contribution.id ?? null)
    setSavingAmount(String(contribution.amount))
    setSavingDate(contribution.date)
    setSavingSourceId(String(contribution.sourceId))
  }

  const deleteGoalContribution = (contribution: GoalContribution) => {
    if (contribution.id === undefined) return
    void runAction(async () => {
      await db.transaction('rw', db.goals, db.goalContributions, db.transactions, async () => {
        const goal = await db.goals.get(contribution.goalId)
        const currentContribution = await db.goalContributions.get(contribution.id!)
        if (!goal || !currentContribution) return

        await db.transactions.delete(currentContribution.transactionId)
        await db.goalContributions.delete(currentContribution.id!)
        await db.goals.update(goal.id!, {
          savedAmount: Math.max(0, goal.savedAmount - currentContribution.amount),
        })
      })
      await Promise.all([refreshGoals(), refreshGoalContributions(), refreshTransactions()])
      if (editingContributionId === contribution.id) {
        setEditingContributionId(null)
        setSavingGoalId(null)
        setSavingAmount('')
        setSavingDate(today())
        setSavingSourceId('')
      }
    })
  }

  const addTask = () => {
    void runAction(async () => {
      await db.tasks.add({
        title: 'Ghi lại chi tiêu hôm nay',
        completed: false,
        reward: 10,
        date: today(),
      })
      await refreshTasks()
    })
  }

  const completeTask = (task: Task) => {
    if (task.id === undefined || task.completed) return
    void runAction(async () => {
      const points = mochiPoints + task.reward
      await db.transaction('rw', db.tasks, db.points, async () => {
        await db.tasks.update(task.id!, { completed: true })
        await db.points.put({ id: 1, total: points })
      })
      setMochiPoints(points)
      await refreshTasks()
    })
  }

  const totalIncome = transactions
    .filter((transaction) => transaction.type === 'income')
    .reduce((sum, transaction) => sum + transaction.amount, 0)
  const totalExpense = transactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((sum, transaction) => sum + transaction.amount, 0)
  const balance = totalIncome - totalExpense
  const sourceBalance = (source: MoneySource) =>
    source.initialBalance + transactions
      .filter((transaction) => transaction.sourceId === source.id && !transaction.isOpeningBalance)
      .reduce((sum, transaction) =>
        sum + (transaction.type === 'income' ? transaction.amount : -transaction.amount), 0)
  const sourceTransactionCount = (sourceId: number) =>
    transactions.filter((transaction) => transaction.sourceId === sourceId).length
  const sourceActivityCount = (sourceId: number) =>
    transactions.filter((transaction) => transaction.sourceId === sourceId && !transaction.isOpeningBalance).length
  const isGoalContributionTransaction = (transactionId?: number) =>
    goalContributions.some((contribution) => contribution.transactionId === transactionId)

  const spentForBudget = (budget: Budget) =>
    transactions
      .filter((transaction) =>
        transaction.type === 'expense' &&
        transaction.category === budget.category &&
        transaction.date.startsWith(budget.month),
      )
      .reduce((sum, transaction) => sum + transaction.amount, 0)

  const pageDetails = navigation.find((item) => item.id === page)
  const moneySourceTypes = [...new Set([
    ...defaultMoneySourceTypes,
    ...moneySources.map((source) => source.type.trim()).filter(Boolean),
  ])]

  if (!username) {
    return (
      <main className="auth-screen">
        <section className="auth-card">
          <div className="auth-brand">
            <span className="auth-mascot" aria-hidden="true">🍡</span>
            <span>mochi</span>
          </div>
          <p className="auth-eyebrow">GÓC NHỎ CỦA RIÊNG BẠN</p>
          <h1>{authMode === 'signup' ? 'Bắt đầu từ tên của bạn' : 'Chào mừng bạn trở lại'}</h1>
          <p className="auth-description">
            {authMode === 'signup'
              ? 'Tạo hồ sơ để Mochi biết nên gọi bạn là gì.'
              : hasLocalAccount ? 'Đăng nhập vào hồ sơ Mochi trên thiết bị này.' : 'Đăng nhập vào hồ sơ Mochi của bạn.'}
          </p>

          <div className="auth-tabs" role="tablist" aria-label="Chọn đăng ký hoặc đăng nhập">
            <button
              type="button"
              role="tab"
              aria-selected={authMode === 'signup'}
              className={authMode === 'signup' ? 'active' : ''}
              onClick={() => { setAuthMode('signup'); setAuthError('') }}
            >
              Tạo tài khoản
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={authMode === 'signin'}
              className={authMode === 'signin' ? 'active' : ''}
              onClick={() => { setAuthMode('signin'); setAuthError('') }}
            >
              Đăng nhập
            </button>
          </div>

          <form className="auth-form" onSubmit={submitAuth}>
            {authMode === 'signup' && (
              <label>
                Tên bạn muốn Mochi gọi
                <input
                  autoComplete="nickname"
                  autoFocus
                  maxLength={30}
                  minLength={2}
                  required
                  value={authName}
                  onChange={(event) => setAuthName(event.target.value)}
                  placeholder="Ví dụ: Linh"
                />
              </label>
            )}
            <label>
              Mật khẩu
              <input
                autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                autoFocus={authMode === 'signin'}
                maxLength={128}
                minLength={authMode === 'signup' ? 8 : undefined}
                required
                type="password"
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
                placeholder={authMode === 'signup' ? 'Ít nhất 8 ký tự' : 'Nhập mật khẩu của bạn'}
              />
            </label>
            {authError && <p className="auth-error" role="alert">{authError}</p>}
            <button className="auth-submit" type="submit" disabled={authBusy}>
              {authBusy ? 'Đang xử lý...' : authMode === 'signup' ? 'Tạo hồ sơ & vào Mochi' : 'Đăng nhập'}
            </button>
          </form>
          <p className="auth-local-note">Hồ sơ chỉ lưu trên thiết bị và trình duyệt này.</p>
        </section>
      </main>
    )
  }

  if (isDataLoading) {
    return (
      <main className="auth-screen">
        <section className="auth-card">
          <div className="auth-brand">
            <span className="auth-mascot" aria-hidden="true">🍡</span>
            <span>mochi</span>
          </div>
          <p className="auth-description">Đang tải lại dữ liệu của bạn...</p>
        </section>
      </main>
    )
  }

  return (
    <div className="mochi-app" style={{ backgroundColor }}>
      <div className="dashboard-menu">
        <button
          className={`dashboard-trigger${menuOpen ? ' is-open' : ''}`}
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="dashboard-navigation"
          aria-label="Mở dashboard"
        >
          <span className="dashboard-trigger-icon" aria-hidden="true">▣</span>
        </button>

        {menuOpen && (
          <nav className="dashboard-popover" id="dashboard-navigation" aria-label="Dashboard">
            <button
              type="button"
              className={`dashboard-nav-item${page === 'home' ? ' active' : ''}`}
              onClick={() => { setPage('home'); setMenuOpen(false) }}
            >
              <span className="dashboard-nav-icon">⌂</span>
              <span><strong>Trang chủ</strong><small>Trở về màn hình chính</small></span>
            </button>
            {navigation.map((item) => (
              <button
                className={`dashboard-nav-item${page === item.id ? ' active' : ''}`}
                key={item.id}
                type="button"
                onClick={() => { setPage(item.id); setMenuOpen(false); setError('') }}
              >
                <span className="dashboard-nav-icon">{item.icon}</span>
                <span><strong>{item.label}</strong><small>{item.description}</small></span>
                <span className="dashboard-nav-arrow" aria-hidden="true">›</span>
              </button>
            ))}
            <button className="dashboard-signout" type="button" onClick={signOut}>Đăng xuất</button>
          </nav>
        )}
      </div>
      <div className="points-badge" aria-label={`${mochiPoints} điểm Mochi`}>
        <span aria-hidden="true">⭐</span><strong>{mochiPoints}</strong>
      </div>

      {(page === 'home' || pageDetails) && (
        <main className="page-shell">
          <header className="home-brand"><h1>mochi</h1></header>
          {pageDetails && (
            <header className="page-heading">
              <div>
                <h1><span aria-hidden="true">{pageDetails.icon}</span> {pageDetails.label}</h1>
                <p className="page-description">{pageDetails.description}</p>
              </div>
              <button className="home-link" type="button" onClick={() => setPage('home')}>
                <span aria-hidden="true">←</span> Trang chủ
              </button>
            </header>
          )}

          {error && <div className="app-error" role="alert">{error}</div>}

          {page === 'budgets' && (
            <div className="page-content">
              <section className="content-card">
                <SectionHeading title={editingBudgetId === null ? 'Tạo ngân sách' : 'Chỉnh sửa ngân sách'} detail="Đặt giới hạn chi tiêu cho từng danh mục." />
                <form className="form-grid" onSubmit={saveBudget}>
                  <label>Danh mục<input required value={budgetCategory} onChange={(event) => setBudgetCategory(event.target.value)} placeholder="Ví dụ: Ăn uống" /></label>
                  <label>Giới hạn chi tiêu<input required type="number" min="1" value={budgetLimit} onChange={(event) => setBudgetLimit(event.target.value)} placeholder="Nhập số tiền" /></label>
                  <label>Tháng áp dụng<input required type="month" value={budgetMonth} onChange={(event) => setBudgetMonth(event.target.value)} /></label>
                  <div className="form-actions">
                    <button className="primary-button" type="submit">{editingBudgetId === null ? '+ Thêm ngân sách' : 'Lưu thay đổi'}</button>
                    {editingBudgetId !== null && <button className="quiet-button" type="button" onClick={() => { setEditingBudgetId(null); setBudgetCategory(''); setBudgetLimit('') }}>Hủy</button>}
                  </div>
                </form>
              </section>
              <section className="dashboard-list-section">
                <SectionHeading title="Ngân sách của bạn" detail={`${budgets.length} ngân sách`} />
                {budgets.length === 0 ? <EmptyState text="Chưa có ngân sách nào. Hãy tạo ngân sách đầu tiên của bạn." /> : (
                  <div className="card-list">
                    {budgets.map((budget) => {
                      const spent = spentForBudget(budget)
                      const percentage = budget.limit > 0 ? Math.min((spent / budget.limit) * 100, 100) : 0
                      return (
                        <article className="content-card budget-card" key={budget.id}>
                          <div className="item-heading"><div><h3>{budget.category}</h3><p>Tháng {budget.month}</p></div><span className={`status-pill${spent > budget.limit ? ' over-budget' : ''}`}>{spent > budget.limit ? 'Đã vượt mức' : `${Math.round(percentage)}% đã dùng`}</span></div>
                          <div className="budget-numbers"><span>Đã chi <strong>{formatMoney(spent)}</strong></span><span>Ngân sách <strong>{formatMoney(budget.limit)}</strong></span></div>
                          <div className="progress-track"><div className={`progress-fill${spent > budget.limit ? ' danger' : ''}`} style={{ width: `${percentage}%` }} /></div>
                          {spent > budget.limit && <p className="over-budget-note">Vượt {formatMoney(spent - budget.limit)}</p>}
                          <div className="item-actions">
                            <button type="button" className="text-button" onClick={() => { setEditingBudgetId(budget.id ?? null); setBudgetCategory(budget.category); setBudgetLimit(String(budget.limit)); setBudgetMonth(budget.month) }}>Sửa</button>
                            {budget.id !== undefined && <button type="button" className="text-button danger-text" onClick={() => deleteBudget(budget.id!)}>Xóa</button>}
                          </div>
                        </article>
                      )
                    })}
                  </div>
                )}
              </section>
            </div>
          )}

          {page === 'goals' && (
            <div className="page-content">
              <section className="content-card">
                <SectionHeading title={editingGoalId === null ? 'Mục tiêu mới' : 'Chỉnh sửa mục tiêu'} detail="Biến kế hoạch tiết kiệm thành từng bước cụ thể." />
                <form className="form-grid" onSubmit={saveGoal}>
                  <label>Tên mục tiêu<input required value={goalName} onChange={(event) => setGoalName(event.target.value)} placeholder="Ví dụ: Mua tai nghe" /></label>
                  <label>Số tiền mục tiêu<input required type="number" min="1" value={goalTargetAmount} onChange={(event) => setGoalTargetAmount(event.target.value)} placeholder="Nhập số tiền" /></label>
                  {editingGoalId === null && <label>Đã tiết kiệm<input type="number" min="0" value={goalSavedAmount} onChange={(event) => setGoalSavedAmount(event.target.value)} placeholder="0đ" /></label>}
                  <label>Hạn hoàn thành<input required type="date" value={goalDeadline} onChange={(event) => setGoalDeadline(event.target.value)} /></label>
                  <div className="form-actions">
                    <button className="primary-button" type="submit">{editingGoalId === null ? '+ Thêm mục tiêu' : 'Lưu thay đổi'}</button>
                    {editingGoalId !== null && <button className="quiet-button" type="button" onClick={() => { setEditingGoalId(null); setGoalName(''); setGoalTargetAmount(''); setGoalDeadline('') }}>Hủy</button>}
                  </div>
                </form>
              </section>
              <section className="dashboard-list-section">
                <SectionHeading title="Mục tiêu tiết kiệm" detail={`${goals.length} mục tiêu`} />
                {goals.length === 0 ? <EmptyState text="Chưa có mục tiêu nào. Bắt đầu với một kế hoạch nhỏ nhé!" /> : (
                  <div className="card-list">
                    {goals.map((goal) => {
                      const percentage = goal.targetAmount > 0 ? Math.min((goal.savedAmount / goal.targetAmount) * 100, 100) : 0
                      const contributions = goalContributions
                        .filter((contribution) => contribution.goalId === goal.id)
                        .sort((a, b) => b.date.localeCompare(a.date) || (b.id ?? 0) - (a.id ?? 0))
                      return (
                        <article className="content-card" key={goal.id}>
                          <div className="item-heading"><div><h3>{goal.name}</h3><p>Hạn: {goal.deadline}</p></div><span className="status-pill">{Math.round(percentage)}%</span></div>
                          <div className="budget-numbers"><span>Đã tiết kiệm <strong>{formatMoney(goal.savedAmount)}</strong></span><span>Mục tiêu <strong>{formatMoney(goal.targetAmount)}</strong></span></div>
                          <div className="progress-track"><div className="progress-fill" style={{ width: `${percentage}%` }} /></div>
                          <details className="goal-contribution-history history-disclosure" open>
                            <summary className="history-disclosure-summary">
                              <span className="history-disclosure-copy">
                                <strong>Lịch sử thêm tiền</strong>
                                <small>{contributions.length} lần thêm tiền</small>
                              </span>
                              <span className="history-chevron" aria-hidden="true">⌄</span>
                            </summary>
                            <div className="history-disclosure-content">
                              {contributions.length === 0 ? <p>Chưa có lần thêm tiền nào.</p> : contributions.map((contribution) => (
                                <div className="goal-contribution-row" key={contribution.id}>
                                  <div className="goal-contribution-details">
                                    <strong>{formatMoney(contribution.amount)}</strong>
                                    <span>{contribution.date} · {moneySources.find((source) => source.id === contribution.sourceId)?.name ?? 'Nguồn tiền không còn tồn tại'}</span>
                                  </div>
                                  <div className="item-actions">
                                    <button type="button" className="text-button" onClick={() => editGoalContribution(contribution)}>Sửa</button>
                                    <button type="button" className="text-button danger-text" onClick={() => deleteGoalContribution(contribution)}>Xóa</button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </details>
                          {savingGoalId === goal.id && (
                            <form className="saving-form" onSubmit={(event) => { if (goal.id !== undefined) saveGoalContribution(event, goal.id) }}>
                              <label className="saving-input-label">Số tiền muốn thêm<input required type="number" min="1" value={savingAmount} onChange={(event) => setSavingAmount(event.target.value)} placeholder="Nhập số tiền" /></label>
                              <label className="saving-input-label">Ngày thêm tiền<input required type="date" value={savingDate} onChange={(event) => setSavingDate(event.target.value)} /></label>
                              <label className="saving-input-label">Trừ từ nguồn tiền
                                <select required value={savingSourceId} onChange={(event) => setSavingSourceId(event.target.value)}>
                                  <option value="">Chọn nguồn tiền</option>
                                  {moneySources.map((source) => (
                                    <option key={source.id} value={source.id}>
                                      {source.name} · {formatMoney(sourceBalance(source))}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <button className="primary-button" type="submit">{editingContributionId === null ? 'Lưu khoản tiết kiệm' : 'Lưu thay đổi'}</button>
                              {editingContributionId !== null && <button className="quiet-button" type="button" onClick={() => { setEditingContributionId(null); setSavingAmount(''); setSavingDate(today()); setSavingSourceId('') }}>Hủy</button>}
                            </form>
                          )}
                          <div className="item-actions">
                            <button type="button" className="text-button" onClick={() => { setSavingGoalId(goal.id ?? null); setEditingContributionId(null); setSavingAmount(''); setSavingDate(today()); setSavingSourceId(moneySources[0]?.id === undefined ? '' : String(moneySources[0].id)) }}>+ Thêm tiền</button>
                            <button type="button" className="text-button" onClick={() => editGoal(goal)}>Sửa</button>
                            {goal.id !== undefined && <button type="button" className="text-button danger-text" onClick={() => deleteGoal(goal.id!)}>Xóa</button>}
                          </div>
                        </article>
                      )
                    })}
                  </div>
                )}
              </section>
            </div>
          )}

          {page === 'tasks' && (
            <div className="page-content">
              <section className="content-card task-intro">
                <div><SectionHeading title="Nhiệm vụ hôm nay" detail="Mỗi nhiệm vụ hoàn thành sẽ tặng bạn điểm Mochi." /><p className="points-total">⭐ {mochiPoints} <span>điểm Mochi</span></p></div>
                <button className="primary-button" type="button" onClick={addTask}>+ Tạo nhiệm vụ</button>
              </section>
              <section className="dashboard-list-section">
                <SectionHeading title="Danh sách nhiệm vụ" detail={`${tasks.filter((task) => !task.completed).length} nhiệm vụ cần hoàn thành`} />
                {tasks.length === 0 ? <EmptyState text="Bạn chưa có nhiệm vụ nào. Tạo nhiệm vụ đầu tiên để bắt đầu nhé!" /> : (
                  <div className="card-list">
                    {tasks.map((task) => (
                      <article className={`content-card task-card${task.completed ? ' task-completed' : ''}`} key={task.id}>
                        <span className="task-check" aria-hidden="true">{task.completed ? '✓' : '○'}</span>
                        <div className="task-copy"><h3>{task.title}</h3><p>{task.completed ? 'Đã hoàn thành' : `🎁 Hoàn thành để nhận ${task.reward} điểm`}</p></div>
                        {!task.completed && <button className="secondary-button" type="button" onClick={() => completeTask(task)}>Hoàn thành</button>}
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {page === 'sources' && (
            <div className="page-content">
              <section className="content-card">
                <SectionHeading
                  title={editingSourceId === null ? 'Thêm nguồn tiền' : 'Chỉnh sửa nguồn tiền'}
                  detail="Tạo các nguồn như tiền mặt, thẻ hoặc tài khoản theo cách bạn muốn."
                />
                <form className="form-grid" onSubmit={saveMoneySource}>
                  <label>Tên nguồn tiền<input required maxLength={50} value={sourceName} onChange={(event) => setSourceName(event.target.value)} placeholder="Ví dụ: Ví hằng ngày" /></label>
                  <label>Loại nguồn tiền
                    <input required maxLength={30} list="money-source-types" value={sourceType} onChange={(event) => setSourceType(event.target.value)} placeholder="Tiền mặt, thẻ, tài khoản..." />
                    <datalist id="money-source-types">
                      {moneySourceTypes.map((type) => <option key={type} value={type} />)}
                    </datalist>
                  </label>
                  <label>Số dư ban đầu<input required type="number" min="0" step="1" value={sourceInitialBalance} onChange={(event) => setSourceInitialBalance(event.target.value)} placeholder="Nhập số tiền hiện có" /></label>
                  <div className="form-actions">
                    <button className="primary-button" type="submit">{editingSourceId === null ? '+ Thêm nguồn tiền' : 'Lưu thay đổi'}</button>
                    {editingSourceId !== null && <button className="quiet-button" type="button" onClick={() => { setEditingSourceId(null); setSourceName(''); setSourceType(''); setSourceInitialBalance('') }}>Hủy</button>}
                  </div>
                </form>
              </section>
              <section className="dashboard-list-section">
                <SectionHeading title="Các nguồn tiền của bạn" detail={`${moneySources.length} nguồn tiền`} />
                {moneySources.length === 0 ? <EmptyState text="Chưa có nguồn tiền nào. Hãy thêm tiền mặt, thẻ hoặc tài khoản đầu tiên." /> : (
                  <div className="card-list">
                    {moneySources.map((source) => {
                      const linkedTransactions = source.id === undefined ? 0 : sourceTransactionCount(source.id)
                      return (
                        <article className="content-card money-source-card" key={source.id}>
                          <div className="item-heading">
                            <div><h3>{source.name}</h3><p>{source.type}</p></div>
                            <span className="status-pill">{linkedTransactions} giao dịch</span>
                          </div>
                          <div className="money-source-balance">
                            <span>Số dư hiện tại</span>
                            <strong>{formatMoney(sourceBalance(source))}</strong>
                          </div>
                          <p className="money-source-starting">Số dư ban đầu: {formatMoney(source.initialBalance)}</p>
                          <div className="item-actions">
                            <button type="button" className="text-button" onClick={() => editMoneySource(source)}>Sửa</button>
                            {source.id !== undefined && sourceActivityCount(source.id) === 0
                              ? <button type="button" className="text-button danger-text" onClick={() => deleteMoneySource(source.id!)}>Xóa</button>
                              : <span className="source-delete-note">Không thể xóa nguồn đã có giao dịch</span>}
                          </div>
                        </article>
                      )
                    })}
                  </div>
                )}
              </section>
            </div>
          )}

          {page === 'settings' && (
            <div className="page-content">
              <section className="content-card">
                <SectionHeading title="Giao diện" detail="Chọn một trong năm màu nền pastel của Mochi." />
                <div className="background-swatch-grid" role="group" aria-label="Màu nền ứng dụng">
                  {pastelBackgrounds.map((option) => (
                    <button
                      className={`background-swatch-option${backgroundColor === option.value ? ' active' : ''}`}
                      key={option.value}
                      type="button"
                      aria-label={`Chọn màu nền ${option.label}`}
                      aria-pressed={backgroundColor === option.value}
                      onClick={() => updateBackgroundColor(option.value)}
                    >
                      <span className="background-swatch" style={{ backgroundColor: option.value }} aria-hidden="true" />
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </section>
              <section className="content-card">
                <SectionHeading title="Tài khoản" detail="Hồ sơ Mochi đang dùng trên thiết bị này." />
                <div className="settings-row"><span>Tên tài khoản</span><strong>{username}</strong></div>
                <button className="secondary-button" type="button" onClick={signOut}>Đăng xuất</button>
              </section>
              <section className="content-card">
                <SectionHeading title="Dữ liệu" detail="Thông tin nơi lưu dữ liệu Mochi." />
                <p className="settings-note">Giao dịch, mục tiêu và nguồn tiền được lưu trong trình duyệt này. Xóa dữ liệu trang web có thể làm mất các thông tin đó.</p>
              </section>
            </div>
          )}

          {(page === 'transactions' || page === 'home') && (
            <div className="page-content">
              <section className="summary-grid" aria-label="Tổng quan giao dịch">
                <SummaryCard label="Tổng thu nhập" value={formatMoney(totalIncome)} tone="income" />
                <SummaryCard label="Tổng chi tiêu" value={formatMoney(totalExpense)} tone="expense" />
                <SummaryCard label="Số dư" value={formatMoney(balance)} tone="balance" />
              </section>
              <section className="content-card">
                <SectionHeading title={editingTransactionId === null ? 'Thêm giao dịch' : 'Chỉnh sửa giao dịch'} detail="Ghi lại thu nhập hoặc chi tiêu của bạn." />
                {moneySources.length === 0 && (
                  <div className="source-required-note">
                    <p>Bạn cần tạo ít nhất một nguồn tiền trước khi ghi giao dịch.</p>
                    <button className="secondary-button" type="button" onClick={() => setPage('sources')}>Tạo nguồn tiền</button>
                  </div>
                )}
                <form className="form-grid transaction-form" onSubmit={saveTransaction}>
                  <label>Loại giao dịch<select value={transactionType} onChange={(event) => setTransactionType(event.target.value as 'income' | 'expense')}><option value="expense">Chi tiêu</option><option value="income">Thu nhập</option></select></label>
                  <label>Số tiền<input required type="number" min="1" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Nhập số tiền" /></label>
                  <label>Danh mục<input required value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Ví dụ: Ăn uống" /></label>
                  <label>Ngày<input required type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
                  <label>Nguồn tiền
                    <select required value={transactionSourceId} onChange={(event) => setTransactionSourceId(event.target.value)} disabled={moneySources.length === 0}>
                      <option value="">{moneySources.length === 0 ? 'Hãy tạo nguồn tiền trước' : 'Chọn nguồn tiền'}</option>
                      {moneySources.map((source) => (
                        <option key={source.id} value={source.id}>
                          {source.name} · {source.type} — {formatMoney(sourceBalance(source))}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="full-width">Ghi chú<input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Thêm ghi chú (không bắt buộc)" /></label>
                  <div className="form-actions">
                    <button className="primary-button" type="submit" disabled={moneySources.length === 0}>{editingTransactionId === null ? '+ Thêm giao dịch' : 'Lưu thay đổi'}</button>
                    {editingTransactionId !== null && <button className="quiet-button" type="button" onClick={() => { setEditingTransactionId(null); setAmount(''); setCategory(''); setNote(''); setDate(today()); setTransactionSourceId('') }}>Hủy</button>}
                  </div>
                </form>
              </section>
              <section className="dashboard-list-section">
                <details className="history-disclosure transaction-history" open>
                  <summary className="history-disclosure-summary">
                    <span className="history-disclosure-copy">
                      <strong>Lịch sử giao dịch</strong>
                      <small>{transactions.length} giao dịch</small>
                    </span>
                    <span className="history-chevron" aria-hidden="true">⌄</span>
                  </summary>
                  <div className="history-disclosure-content">
                    {transactions.length === 0 ? <EmptyState text="Chưa có giao dịch nào được ghi lại." /> : (
                      <div className="content-card transaction-list">
                        {transactions.slice().sort((a, b) => b.date.localeCompare(a.date)).map((transaction) => (
                          <article className="transaction-row" key={transaction.id}>
                            <span className={`transaction-icon ${transaction.type}`}>{transaction.type === 'income' ? '↙' : '↗'}</span>
                            <div className="transaction-copy"><h3>{transaction.category}</h3><p>{transaction.note || (transaction.type === 'income' ? 'Thu nhập' : 'Chi tiêu')} · {transaction.date} · {moneySources.find((source) => source.id === transaction.sourceId)?.name ?? 'Chưa chọn nguồn tiền'}</p></div>
                            <strong className={`transaction-amount ${transaction.type}`}>{transaction.type === 'income' ? '+' : '−'}{formatMoney(transaction.amount)}</strong>
                            {transaction.isOpeningBalance || isGoalContributionTransaction(transaction.id) ? (
                              <span className="source-delete-note">{transaction.isOpeningBalance ? 'Điều chỉnh tại nguồn tiền' : 'Điều chỉnh tại mục tiêu'}</span>
                            ) : (
                              <div className="item-actions">
                                <button className="text-button" type="button" onClick={() => editTransaction(transaction)}>Sửa</button>
                                {transaction.id !== undefined && <button className="text-button danger-text" type="button" onClick={() => deleteTransaction(transaction.id!)}>Xóa</button>}
                              </div>
                            )}
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                </details>
              </section>
            </div>
          )}
        </main>
      )}
      <AssistantWidget username={username} />
    </div>
  )
}

function SectionHeading({ title, detail }: { title: string; detail: string }) {
  return <div className="section-heading"><h2>{title}</h2><p>{detail}</p></div>
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state"><span aria-hidden="true">🌷</span><p>{text}</p></div>
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: 'income' | 'expense' | 'balance' }) {
  return <article className={`summary-card ${tone}`}><p>{label}</p><strong>{value}</strong></article>
}

export default App
