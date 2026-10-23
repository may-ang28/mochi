import { useEffect, useRef, useState, type FormEvent } from 'react'
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
import { mascotExpressions, type MascotExpression } from './mascot'
import {
  createLocalAccount,
  getLocalAccounts,
  getSignedInAccountStorageKey,
  getSignedInUsername,
  signInLocalAccount,
  signOutLocalAccount,
} from './auth'
import './App.css'

type Page = 'home' | 'charts' | 'wardrobe' | 'budgets' | 'goals' | 'tasks' | 'transactions' | 'sources' | 'settings'

type AccessorySlot = 'clip' | 'hat'
type MochiOutfit = Record<AccessorySlot, string> & { color: string; expression: MascotExpression }
type AccessoryOption = { id: string; label: string; icon: string; cost?: number }

const accessorySlots: { id: AccessorySlot; label: string; options: AccessoryOption[] }[] = [
  { id: 'clip', label: 'Kẹp tóc', options: [{ id: 'none', label: 'Không', icon: '−' }, { id: 'bow', label: 'Nơ', icon: '🎀', cost: 10 }, { id: 'flower', label: 'Hoa', icon: '🌼', cost: 15 }, { id: 'star', label: 'Sao', icon: '⭐', cost: 20 }] },
  { id: 'hat', label: 'Mũ', options: [{ id: 'none', label: 'Không', icon: '−' }, { id: 'cap', label: 'Mũ', icon: '🧢', cost: 15 }, { id: 'crown', label: 'Vương miện', icon: '👑', cost: 30 }, { id: 'berry', label: 'Mũ dâu', icon: '🍓', cost: 25 }] },
]
const mochiColors = [
  { id: 'pink', label: 'Hồng mochi', color: '#ff91b8' },
  { id: 'mint', label: 'Bạc hà', color: '#74c8a1' },
  { id: 'sunshine', label: 'Nắng', color: '#f2c45e' },
  { id: 'sky', label: 'Xanh trời', color: '#7eb9e8' },
  { id: 'lilac', label: 'Tử đinh hương', color: '#ad91db' },
  { id: 'peach', label: 'Đào', color: '#f29a78' },
]
const readMochiOutfit = (): MochiOutfit => {
  try {
    const saved = JSON.parse(localStorage.getItem(getAccountPreferenceKey('mochi-outfit')) ?? '{}') as Partial<MochiOutfit>
    const accessories = Object.fromEntries(accessorySlots.map(({ id, options }) => {
      const savedValue = saved[id]
      return [id, options.some((option) => option.id === savedValue) ? savedValue : 'none']
    })) as Record<AccessorySlot, string>
    return {
      ...accessories,
      color: mochiColors.some((option) => option.id === saved.color) ? saved.color! : 'pink',
      expression: mascotExpressions.some((option) => option.id === saved.expression) ? saved.expression! : 'happy',
    }
  } catch {
    return { clip: 'none', hat: 'none', color: 'pink', expression: 'happy' }
  }
}

function MochiWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`mochi-wordmark${compact ? ' compact' : ''}`} aria-label="Mochi logo">
      <img className="mochi-logo-svg" src={`${import.meta.env.BASE_URL}mochi-logo.svg`} alt="Mochi" />
    </div>
  )
}

const navigation: { id: Page; label: string; icon: string; description: string }[] = [
  { id: 'charts', label: 'Biểu đồ', icon: '◒', description: 'Tổng quan dòng tiền' },
  { id: 'wardrobe', label: 'Tủ đồ', icon: '🧢', description: 'Chọn phụ kiện cho Mochi' },
  { id: 'budgets', label: 'Ngân sách', icon: '💰', description: 'Theo dõi hạn mức chi tiêu' },
  { id: 'goals', label: 'Mục tiêu', icon: '🎯', description: 'Lên kế hoạch tiết kiệm' },
  { id: 'tasks', label: 'Nhiệm vụ', icon: '📝', description: 'Hoàn thành việc nhỏ mỗi ngày' },
  { id: 'transactions', label: 'Giao dịch', icon: '💳', description: 'Quản lý thu nhập và chi tiêu' },
  { id: 'sources', label: 'Nguồn tiền', icon: '👛', description: 'Theo dõi số dư từng nguồn tiền' },
  { id: 'settings', label: 'Cài đặt', icon: '⚙️', description: 'Tài khoản và dữ liệu ứng dụng' },
]

const today = () => new Date().toISOString().slice(0, 10)
const currentMonth = () => new Date().toISOString().slice(0, 7)
const formatMoney = (amount: number) => `${amount.toLocaleString('vi-VN')} MO`
const BACKGROUND_COLOR_KEY = 'mochi-background-color'
const getAccountPreferenceKey = (key: string) => {
  const storageKey = getSignedInAccountStorageKey()
  return storageKey && storageKey !== 'legacy' ? `${key}:${storageKey}` : key
}
const pastelBackgrounds = [
  { label: 'Hồng Mochi', value: '#fce7f3' },
  { label: 'Xanh bạc hà', value: '#e8f5ed' },
  { label: 'Tím lavender', value: '#f0ebf8' },
  { label: 'Đào nhạt', value: '#fff0e6' },
  { label: 'Xanh trời', value: '#e7f2fa' },
]
const getInitialBackgroundColor = () => {
  try {
    const savedColor = localStorage.getItem(getAccountPreferenceKey(BACKGROUND_COLOR_KEY))
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

const getTaskStreak = (entries: Task[]) => {
  const completedDates = new Set(entries.filter((task) => task.completed).map((task) => task.date))
  const currentDate = new Date(`${today()}T00:00:00`)
  if (!completedDates.has(today())) currentDate.setDate(currentDate.getDate() - 1)

  let streak = 0
  while (completedDates.has(currentDate.toISOString().slice(0, 10))) {
    streak += 1
    currentDate.setDate(currentDate.getDate() - 1)
  }
  return streak
}

function App() {
  const [storedAuth] = useState<{
    username: string | null
    mode: 'signup' | 'signin'
    error: string
  }>(() => {
    try {
      const accounts = getLocalAccounts()
      const signedInUsername = getSignedInUsername()
      const signedInAccount = accounts.find(
        (account) => account.username.trim().toLocaleLowerCase('vi-VN') === signedInUsername?.trim().toLocaleLowerCase('vi-VN'),
      )
      if (signedInAccount) {
        return { username: signedInAccount.username, mode: 'signin', error: '' }
      }
      signOutLocalAccount()
      return {
        username: null,
        mode: accounts.length > 0 ? 'signin' : 'signup',
        error: '',
      }
    } catch (authLoadError) {
      return {
        username: null,
        mode: 'signup',
        error: authLoadError instanceof Error ? authLoadError.message : 'Không thể đọc hồ sơ.',
      }
    }
  })
  const [username, setUsername] = useState<string | null>(storedAuth.username)
  const [authMode, setAuthMode] = useState<'signup' | 'signin'>(storedAuth.mode)
  const [authName, setAuthName] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [allowPasswordManager, setAllowPasswordManager] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState(storedAuth.error)
  const [page, setPage] = useState<Page>('home')
  const [isDashboardOpen, setIsDashboardOpen] = useState(true)
  const [backgroundColor, setBackgroundColor] = useState(getInitialBackgroundColor)
  const [savedMochiOutfit, setSavedMochiOutfit] = useState<MochiOutfit>(readMochiOutfit)
  const [mochiOutfit, setMochiOutfit] = useState<MochiOutfit>(savedMochiOutfit)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [isSplashVisible, setIsSplashVisible] = useState(true)
  const [sourceFilter, setSourceFilter] = useState('Tổng')
  const [activeSourceIndex, setActiveSourceIndex] = useState(0)
  const [activeBudgetIndex, setActiveBudgetIndex] = useState(0)
  const [isBudgetJarActive, setIsBudgetJarActive] = useState(false)
  const [jarMotionDirection, setJarMotionDirection] = useState<'left' | 'right' | null>('right')
  const [pendingJar, setPendingJar] = useState<{ type: 'source' | 'budget'; index: number; direction: 'left' | 'right'; sourceFilter?: string } | null>(null)
  const [openJarKey, setOpenJarKey] = useState<string | null>(null)
  const [draggedBudgetCategory, setDraggedBudgetCategory] = useState<string | null>(null)
  const [draggedBudgetId, setDraggedBudgetId] = useState<number | null>(null)
  const [budgetExpenseTarget, setBudgetExpenseTarget] = useState<Budget | null>(null)
  const [budgetExpenseAmount, setBudgetExpenseAmount] = useState('')
  const [mochiDropId, setMochiDropId] = useState(0)
  const budgetDropHandled = useRef(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [goalContributions, setGoalContributions] = useState<GoalContribution[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [taskTitle, setTaskTitle] = useState('')
  const [taskReward, setTaskReward] = useState('10')
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false)
  const [moneySources, setMoneySources] = useState<MoneySource[]>([])
  const [mochiPoints, setMochiPoints] = useState(0)
    const [unlockedAccessories, setUnlockedAccessories] = useState<string[]>([])
  const [pointsPulse, setPointsPulse] = useState(0)
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
    const splashTimer = window.setTimeout(() => setIsSplashVisible(false), 2200)
    return () => window.clearTimeout(splashTimer)
  }, [])

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
        const savedUnlocks = savedPoints?.unlockedAccessories ?? []
        const persistedOutfit = readMochiOutfit()
        const equippedLegacyAccessories = accessorySlots
          .map(({ id }) => persistedOutfit[id] === 'none' ? null : `${id}:${persistedOutfit[id]}`)
          .filter((accessory): accessory is string => accessory !== null)
        const mergedUnlocks = [...new Set([...savedUnlocks, ...equippedLegacyAccessories])]
        setTransactions(allTransactions)
        setBudgets(allBudgets)
        setGoals(allGoals)
        setGoalContributions(allGoalContributions)
        setTasks(allTasks)
        setMoneySources(allMoneySources)
        setMochiPoints(savedPoints?.total ?? 0)
        setUnlockedAccessories(mergedUnlocks)
        if (mergedUnlocks.length !== savedUnlocks.length) {
          await db.points.put({
            ...savedPoints,
            id: 1,
            total: savedPoints?.total ?? 0,
            unlockedAccessories: mergedUnlocks,
          })
        }
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
        setIsDataLoading(true)
        setUsername(normalizedName)
      } else {
        const normalizedName = authName.trim()
        if (!normalizedName) {
          throw new Error('Hãy nhập tên tài khoản.')
        }
        if (authPassword.length > 128) {
          throw new Error('Mật khẩu không được dài quá 128 ký tự.')
        }
        const signedInUsername = await signInLocalAccount(normalizedName, authPassword)
        setIsDataLoading(true)
        setUsername(signedInUsername)
      }
      setBackgroundColor(getInitialBackgroundColor())
      setSavedMochiOutfit(readMochiOutfit())
      setMochiOutfit(readMochiOutfit())
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
    setAuthMode('signin')
    setAuthName('')
    setAuthPassword('')
    setAllowPasswordManager(false)
    setAuthError('')
  }

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
        setError(taskError instanceof Error ? taskError.message : 'Không thể xóa nhiệm vụ đã hết hạn.')
      })
    }, Math.max(0, nextExpiry - Date.now()))

    return () => window.clearTimeout(timer)
  }, [tasks, username])

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
      localStorage.setItem(getAccountPreferenceKey(BACKGROUND_COLOR_KEY), color)
    } catch {
      setError('Không thể lưu màu nền trên thiết bị này.')
    }
  }

  const updateMochiOutfit = (slot: AccessorySlot, accessoryId: string) => {
    setMochiOutfit((current) => ({ ...current, [slot]: accessoryId }))
  }

  const selectAccessory = (slot: AccessorySlot, option: AccessoryOption) => {
    const accessoryKey = `${slot}:${option.id}`
    if (!option.cost || unlockedAccessories.includes(accessoryKey)) {
      updateMochiOutfit(slot, option.id)
      return
    }

    void runAction(async () => {
      let pointsAfterPurchase = mochiPoints
      let ownedAccessories: string[] = []
      await db.transaction('rw', db.points, async () => {
        const pointsRecord = await db.points.get(1)
        ownedAccessories = pointsRecord?.unlockedAccessories ?? []
        if (ownedAccessories.includes(accessoryKey)) {
          pointsAfterPurchase = pointsRecord?.total ?? 0
          return
        }

        const availablePoints = pointsRecord?.total ?? 0
        if (availablePoints < option.cost!) {
          throw new Error(`Cần ${option.cost} sao để đổi ${option.label}.`)
        }

        pointsAfterPurchase = availablePoints - option.cost!
        ownedAccessories = [...ownedAccessories, accessoryKey]
        await db.points.put({
          ...pointsRecord,
          id: 1,
          total: pointsAfterPurchase,
          unlockedAccessories: ownedAccessories,
        })
      })

      setMochiPoints(pointsAfterPurchase)
      setUnlockedAccessories(ownedAccessories)
      setPointsPulse((pulse) => pulse + 1)
      updateMochiOutfit(slot, option.id)
    })
  }

  const updateMochiColor = (color: string) => {
    if (!mochiColors.some((option) => option.id === color)) return
    setMochiOutfit((current) => ({ ...current, color }))
  }

  const updateMochiExpression = (expression: MascotExpression) => {
    setMochiOutfit((current) => ({ ...current, expression }))
  }

  const outfitHasChanges = accessorySlots.some((slot) => mochiOutfit[slot.id] !== savedMochiOutfit[slot.id]) ||
    mochiOutfit.color !== savedMochiOutfit.color || mochiOutfit.expression !== savedMochiOutfit.expression

  const saveMochiOutfit = () => {
    try {
      localStorage.setItem(getAccountPreferenceKey('mochi-outfit'), JSON.stringify(mochiOutfit))
      setSavedMochiOutfit({ ...mochiOutfit })
      setError('')
    } catch {
      setError('Không thể lưu diện mạo Mochi trên thiết bị này.')
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

  const saveBudgetExpense = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!budgetExpenseTarget) return
    void runAction(async () => {
      const value = Number(budgetExpenseAmount)
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error('Số MO cần lớn hơn 0.')
      }
      const sourceId = activeSource?.id ?? moneySources[0]?.id
      if (sourceId === undefined) {
        throw new Error('Hãy tạo nguồn tiền trước khi ghi khoản chi này.')
      }

      await db.transactions.add({
        type: 'expense',
        amount: value,
        category: budgetExpenseTarget.category,
        note: `Chi từ ngân sách ${budgetExpenseTarget.category}`,
        date: today(),
        sourceId,
      })
      await refreshTransactions()
      setBudgetExpenseTarget(null)
      setBudgetExpenseAmount('')
      setMochiDropId((id) => id + 1)
      const jarKey = `budget:${budgetExpenseTarget.id ?? budgetExpenseTarget.category}`
      setOpenJarKey(jarKey)
      window.setTimeout(() => setOpenJarKey((openKey) => openKey === jarKey ? null : openKey), 700)
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
        throw new Error('Số MO cần là số nguyên lớn hơn 0.')
      }
      if (!savingDate) throw new Error('Hãy chọn ngày thêm tiền.')
      const sourceId = Number(savingSourceId)
      if (!moneySources.some((source) => source.id === sourceId)) {
        throw new Error('Hãy chọn một nguồn tiền hợp lệ cho khoản tiết kiệm.')
      }

      let pointsAfterGoalCompletion: number | undefined
      await db.transaction('rw', db.goals, db.goalContributions, db.transactions, db.tasks, db.points, async () => {
        const goal = await db.goals.get(goalId)
        if (!goal) throw new Error('Không tìm thấy mục tiêu tiết kiệm.')
        let updatedSavedAmount: number

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
          updatedSavedAmount = goal.savedAmount + value
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
          updatedSavedAmount = goal.savedAmount - contribution.amount + value
        }

        await db.goals.update(goalId, { savedAmount: updatedSavedAmount })
        if (updatedSavedAmount >= goal.targetAmount) {
          const linkedTasks = (await db.tasks.toArray()).filter((task) => task.goalId === goalId && !task.completed && task.id !== undefined)
          if (linkedTasks.length > 0) {
            const completedAt = new Date().toISOString()
            for (const task of linkedTasks) {
              await db.tasks.update(task.id!, { completed: true, completedAt })
            }
            await db.goals.update(goalId, { taskRewarded: true })
            const pointsRecord = await db.points.get(1)
            pointsAfterGoalCompletion = pointsRecord?.total ?? 0
            pointsAfterGoalCompletion += linkedTasks.reduce((reward, task) => reward + task.reward, 0)
            await db.points.put({
              ...pointsRecord,
              id: 1,
              total: pointsAfterGoalCompletion,
              unlockedAccessories: pointsRecord?.unlockedAccessories ?? [],
            })
          }
        }
      })
      if (pointsAfterGoalCompletion !== undefined) {
        setMochiPoints(pointsAfterGoalCompletion)
        setPointsPulse((pulse) => pulse + 1)
      }
      await Promise.all([refreshGoals(), refreshGoalContributions(), refreshTransactions(), refreshTasks()])
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

  const addTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void runAction(async () => {
      const title = taskTitle.trim()
      const reward = Number(taskReward)
      if (!title) throw new Error('Hãy nhập tên nhiệm vụ.')
      if (!Number.isSafeInteger(reward) || reward <= 0) throw new Error('Điểm thưởng cần là số nguyên lớn hơn 0.')
      await db.tasks.add({
        title,
        completed: false,
        reward,
        date: today(),
      })
      await refreshTasks()
      setTaskTitle('')
      setTaskReward('10')
      setIsTaskFormOpen(false)
    })
  }

  const completeTask = (task: Task) => {
    if (task.id === undefined || task.completed) return
    void runAction(async () => {
      let points: number | undefined
      await db.transaction('rw', db.tasks, db.points, async () => {
        const currentTask = await db.tasks.get(task.id!)
        if (!currentTask || currentTask.completed) return
        await db.tasks.update(task.id!, { completed: true, completedAt: new Date().toISOString() })
        const pointsRecord = await db.points.get(1)
        points = pointsRecord?.total ?? 0
        points += currentTask.reward
        await db.points.put({
          ...pointsRecord,
          id: 1,
          total: points,
          unlockedAccessories: pointsRecord?.unlockedAccessories ?? [],
        })
      })
      if (points !== undefined) {
        setMochiPoints(points)
        setPointsPulse((pulse) => pulse + 1)
      }
      await refreshTasks()
    })
  }

  const deleteTask = (task: Task) => {
    if (task.id === undefined) return
    void runAction(async () => {
      await db.tasks.delete(task.id!)
      await refreshTasks()
    })
  }

  const createGoalTask = (goal: Goal) => {
    if (goal.id === undefined) return
    void runAction(async () => {
      let points: number | undefined
      await db.transaction('rw', db.goals, db.tasks, db.points, async () => {
        const currentGoal = await db.goals.get(goal.id!)
        if (!currentGoal || currentGoal.taskRewarded) return
        const existingTasks = (await db.tasks.toArray()).filter((task) => task.goalId === currentGoal.id)
        if (existingTasks.length > 0) return

        const completed = currentGoal.savedAmount >= currentGoal.targetAmount
        const completedAt = completed ? new Date().toISOString() : undefined
        const taskId = await db.tasks.add({
          title: `Hoàn thành mục tiêu: ${currentGoal.name}`,
          completed,
          reward: 25,
          date: today(),
          goalId: currentGoal.id,
          ...(completedAt ? { completedAt } : {}),
        })

        if (completed) {
          const pointsRecord = await db.points.get(1)
          points = (pointsRecord?.total ?? 0) + 25
          await db.points.put({
            ...pointsRecord,
            id: 1,
            total: points,
            unlockedAccessories: pointsRecord?.unlockedAccessories ?? [],
          })
          await db.goals.update(currentGoal.id!, { taskRewarded: true })
          await db.tasks.update(taskId, { completedAt })
        }
      })
      if (points !== undefined) {
        setMochiPoints(points)
        setPointsPulse((pulse) => pulse + 1)
        await refreshGoals()
      }
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
  const remainingForBudget = (budget: Budget) => Math.max(0, budget.limit - spentForBudget(budget))
  const budgetUsagePercent = (budget: Budget) => budget.limit > 0
    ? Math.min((spentForBudget(budget) / budget.limit) * 100, 100)
    : 0
  const budgetMochiCount = (budget: Budget) => Math.min(12, Math.ceil((budgetUsagePercent(budget) / 100) * 12))

  const pageDetails = navigation.find((item) => item.id === page)
  const moneySourceTypes = [...new Set([
    ...defaultMoneySourceTypes,
    ...moneySources.map((source) => source.type.trim()).filter(Boolean),
  ])]
  const sourceFilters = ['Tổng', ...new Set(moneySources.map((source) => source.type).filter(Boolean))]
  const visibleSources = sourceFilter === 'Tổng'
    ? moneySources
    : moneySources.filter((source) => source.type === sourceFilter)
  const safeSourceIndex = visibleSources.length ? activeSourceIndex % visibleSources.length : 0
  const activeSource = visibleSources[safeSourceIndex]
  const previousSource = visibleSources.length > 1
    ? visibleSources[(safeSourceIndex - 1 + visibleSources.length) % visibleSources.length]
    : undefined
  const nextSource = visibleSources.length > 1
    ? visibleSources[(safeSourceIndex + 1) % visibleSources.length]
    : undefined
  const taskStreak = getTaskStreak(tasks)
  const budgetPalette = ['#f7d4e3', '#ffe3b3', '#dfeeff', '#dff7e9', '#e9ddff', '#ffd9d9']
  const getBudgetBubbleLabel = (category: string) => {
    const cleaned = category.trim()
    if (!cleaned) return 'Mục'

    const words = cleaned.split(/\s+/).filter(Boolean)
    const displayName = words.slice(0, 2).join(' ')

    if (displayName.length <= 12) return displayName
    return `${displayName.slice(0, 11)}…`
  }
  const getBudgetBubbleColor = (category: string) => {
    const cleaned = category.trim() || 'mục'
    let sum = 0
    for (let index = 0; index < cleaned.length; index += 1) {
      sum += cleaned.charCodeAt(index)
    }
    return budgetPalette[sum % budgetPalette.length]
  }
  const budgetBubbleList = budgets.length > 0
    ? budgets.map((budget) => ({
        id: budget.id ?? budget.category,
        budgetId: budget.id,
        category: budget.category,
        label: getBudgetBubbleLabel(budget.category),
        tone: getBudgetBubbleColor(budget.category),
        type: 'budget' as const,
      }))
    : [{
        id: 'create-budget',
        label: '+',
        tone: '#fff1f5',
        type: 'create' as const,
      }]
  const visibleBudgetBubbles = budgets.length > 0
    ? (() => {
        const maxVisible = 4
        if (budgetBubbleList.length <= maxVisible) {
          return [
            ...budgetBubbleList,
            {
              id: 'create-budget',
              label: '+',
              tone: '#fff1f5',
              type: 'create' as const,
            },
          ]
        }

        return [
          ...budgetBubbleList.slice(0, maxVisible - 2),
          {
            id: 'budget-overflow',
            label: '•••',
            tone: '#f3e7ef',
            type: 'overflow' as const,
          },
          {
            id: 'create-budget',
            label: '+',
            tone: '#fff1f5',
            type: 'create' as const,
          },
        ]
      })()
    : [{
        id: 'create-budget',
        label: '+',
        tone: '#fff1f5',
        type: 'create' as const,
      }]
  const safeBudgetIndex = visibleBudgetBubbles.length ? activeBudgetIndex % visibleBudgetBubbles.length : 0
  const activeBudgetBubble = visibleBudgetBubbles[safeBudgetIndex]
  const activeBudgetDetail = activeBudgetBubble.type === 'budget'
    ? budgets.find((budget) => budget.id === activeBudgetBubble.budgetId) ?? budgets.find((budget) => budget.category === activeBudgetBubble.category)
    : null
  const draggedBudget = budgets.find((budget) => budget.id === draggedBudgetId)
    ?? budgets.find((budget) => budget.category === draggedBudgetCategory)
  const canReceiveDraggedBudget = Boolean(draggedBudget) && !pendingJar && (
    isBudgetJarActive
      ? activeBudgetDetail === draggedBudget
      : true
  )
  const activeJarKey = isBudgetJarActive
    ? `budget:${activeBudgetDetail?.id ?? activeBudgetDetail?.category ?? safeBudgetIndex}`
    : `source:${activeSource?.id ?? 'default'}`
  const isActiveJarOpen = openJarKey === activeJarKey
  const incomingSourceList = pendingJar?.type === 'source'
    ? pendingJar.sourceFilter === 'Tổng' || !pendingJar.sourceFilter
      ? moneySources
      : moneySources.filter((source) => source.type === pendingJar.sourceFilter)
    : []
  const incomingSource = pendingJar?.type === 'source' ? incomingSourceList[pendingJar.index] : undefined
  const incomingBudgetBubble = pendingJar?.type === 'budget' ? visibleBudgetBubbles[pendingJar.index] : undefined
  const incomingBudget = incomingBudgetBubble?.type === 'budget'
    ? budgets.find((budget) => budget.id === incomingBudgetBubble.budgetId) ?? budgets.find((budget) => budget.category === incomingBudgetBubble.category)
    : undefined
  const budgetJarIndices = visibleBudgetBubbles.reduce<number[]>((indices, bubble, index) => {
    if (bubble.type === 'budget') indices.push(index)
    return indices
  }, [])
  const beginJarTransition = (type: 'source' | 'budget', index: number, direction: 'left' | 'right', nextSourceFilter?: string) => {
    if (pendingJar) return
    if (type === 'budget' && isBudgetJarActive && index === safeBudgetIndex) return
    if (type === 'source' && !isBudgetJarActive && index === safeSourceIndex && nextSourceFilter === sourceFilter) return
    setPendingJar({ type, index, direction, sourceFilter: nextSourceFilter })
    setOpenJarKey(null)
    setMochiDropId(0)
  }
  const expenseCategoryTotals = [...transactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((totals, transaction) => totals.set(
      transaction.category,
      (totals.get(transaction.category) ?? 0) + transaction.amount,
    ), new Map<string, number>())]
    .sort((first, second) => second[1] - first[1])
  const cashflowMonths = Array.from({ length: 6 }, (_, index) => {
    const date = new Date()
    date.setDate(1)
    date.setMonth(date.getMonth() - (5 - index))
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const monthTransactions = transactions.filter((transaction) => transaction.date.startsWith(monthKey))
    return {
      key: monthKey,
      label: date.toLocaleDateString('vi-VN', { month: 'short' }),
      income: monthTransactions.filter((transaction) => transaction.type === 'income').reduce((sum, transaction) => sum + transaction.amount, 0),
      expense: monthTransactions.filter((transaction) => transaction.type === 'expense').reduce((sum, transaction) => sum + transaction.amount, 0),
    }
  })
  const cashflowMax = Math.max(1, ...cashflowMonths.flatMap((month) => [month.income, month.expense]))

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
              : 'Nhập tên tài khoản và mật khẩu đã lưu trên thiết bị này.'}
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
            <label>
              {authMode === 'signup' ? 'Tên bạn muốn Mochi gọi' : 'Tên tài khoản'}
              <input
                autoComplete={authMode === 'signup' ? 'nickname' : allowPasswordManager ? 'username' : 'off'}
                autoFocus={authMode === 'signup'}
                maxLength={30}
                minLength={2}
                required
                value={authName}
                onChange={(event) => setAuthName(event.target.value)}
                placeholder="Ví dụ: Linh"
              />
            </label>
            <label>
              Mật khẩu
              <input
                autoComplete={authMode === 'signup' ? 'new-password' : allowPasswordManager ? 'current-password' : 'off'}
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
            {authMode === 'signin' && (
              <label className="auth-remember-password">
                <input
                  type="checkbox"
                  checked={allowPasswordManager}
                  onChange={(event) => setAllowPasswordManager(event.target.checked)}
                />
                Cho phép trình duyệt đề xuất lưu mật khẩu
              </label>
            )}
            {authError && <p className="auth-error" role="alert">{authError}</p>}
            <button className="auth-submit" type="submit" disabled={authBusy}>
              {authBusy ? 'Đang xử lý...' : authMode === 'signup' ? 'Tạo hồ sơ & vào Mochi' : 'Đăng nhập'}
            </button>
          </form>
          <p className="auth-local-note">Có thể tạo nhiều tài khoản trên thiết bị này. Hồ sơ chỉ lưu trong trình duyệt này.</p>
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
    <>
      <div className={`app-splash${isSplashVisible ? '' : ' hidden'}`} aria-live="polite" aria-hidden={!isSplashVisible}>
        <MochiWordmark />
      </div>

      <div className={`mochi-app mochi-workspace${isDashboardOpen ? '' : ' dashboard-collapsed'}`} style={{ backgroundColor }}>
        <button
          className={`dashboard-toggle${isDashboardOpen ? ' is-open' : ''}`}
          type="button"
          aria-label={isDashboardOpen ? 'Thu gọn menu' : 'Mở menu'}
          aria-expanded={isDashboardOpen}
          aria-controls="mochi-navigation"
          title={isDashboardOpen ? 'Thu gọn menu' : 'Mở menu'}
          onClick={() => setIsDashboardOpen((open) => !open)}
        >
          <span aria-hidden="true">{isDashboardOpen ? '‹' : '☰'}</span>
        </button>

        <aside className="mochi-sidebar" id="mochi-navigation" aria-hidden={!isDashboardOpen}>
          <button className="mochi-logo-slot mochi-logo-home" type="button" aria-label="Mochi - về trang chủ" onClick={() => setPage('home')}>
            <MochiWordmark compact />
          </button>
          <nav className="sidebar-primary-nav" aria-label="Điều hướng chính">
            <button className={`sidebar-nav-item${page === 'home' ? ' active' : ''}`} type="button" onClick={() => setPage('home')}>
              <span aria-hidden="true">⌂</span> Home
            </button>
            <button className={`sidebar-nav-item${page === 'charts' ? ' active' : ''}`} type="button" onClick={() => setPage('charts')}>
              <span aria-hidden="true">◒</span> Charts
            </button>
            <button className={`sidebar-nav-item${page === 'wardrobe' ? ' active' : ''}`} type="button" onClick={() => setPage('wardrobe')}>
              <span aria-hidden="true">🧢</span> Tủ đồ
            </button>
            <button className="sidebar-nav-item" type="button" onClick={() => setAssistantOpen(true)}>
              <span aria-hidden="true">✳</span> AI assistant
            </button>
          </nav>
          <div className="sidebar-divider" />
          <p className="sidebar-section-label">QUẢN LÝ</p>
          <nav className="sidebar-secondary-nav" aria-label="Quản lý tài chính">
            {navigation.filter((item) => !['charts', 'wardrobe', 'settings'].includes(item.id)).map((item) => (
              <button
                className={`sidebar-nav-item${page === item.id ? ' active' : ''}`}
                key={item.id}
                type="button"
                onClick={() => { setPage(item.id); setError('') }}
              >
                <span aria-hidden="true">{item.icon}</span> {item.label}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <button className={`sidebar-nav-item${page === 'settings' ? ' active' : ''}`} type="button" onClick={() => setPage('settings')}>
              <span aria-hidden="true">⚙</span> Cài đặt
            </button>
            <button className="sidebar-signout" type="button" onClick={signOut}>Đăng xuất</button>
          </div>
        </aside>

        <main className={`workspace-main${page === 'home' ? ' workspace-main-home' : ''}`}>
          {page === 'home' ? (
            <div className="home-dashboard">
              <header className="home-dashboard-header">
                <div>
                  <p className="dashboard-eyebrow">GÓC NHỎ CỦA BẠN</p>
                </div>
              </header>

              <section className="home-quote" aria-label="Trích dẫn hôm nay">
                <p>“Mỗi ngày một chút, rồi bạn sẽ đi được rất xa.”</p>
                <span>Một lời nhắc dịu dàng cho hôm nay</span>
              </section>

              <section className="home-streak" aria-label="Chuỗi ngày hoàn thành nhiệm vụ">
                <span className="streak-mascot" aria-hidden="true">🍡</span>
                <div>
                  <strong>{taskStreak} ngày liên tiếp</strong>
                  <span>Hãy hoàn thành một nhiệm vụ nhỏ hôm nay</span>
                </div>
                <div className="streak-dots" aria-hidden="true">
                  {Array.from({ length: 7 }, (_, index) => <span className={index >= 7 - Math.min(taskStreak, 7) ? 'complete' : ''} key={index} />)}
                </div>
              </section>

              <section className="home-money-section">
                <header className="home-section-heading">
                  <div>
                    <p className="dashboard-eyebrow">TÀI CHÍNH CỦA BẠN</p>
                    <h2>Những chiếc hũ</h2>
                  </div>
                  <button className="home-add-source" type="button" onClick={() => setPage('sources')}>
                    + Thêm nguồn tiền
                  </button>
                </header>

                <div className="source-filters" role="group" aria-label="Lọc nguồn tiền">
                  {sourceFilters.map((filter) => (
                    <button
                      className={sourceFilter === filter ? 'active' : ''}
                      key={filter}
                      type="button"
                      aria-pressed={sourceFilter === filter}
                      disabled={Boolean(pendingJar)}
                      onClick={() => {
                        const filteredSources = filter === 'Tổng'
                          ? moneySources
                          : moneySources.filter((source) => source.type === filter)
                        if (!filteredSources.length && filter !== 'Tổng') return
                        beginJarTransition('source', 0, 'right', filter)
                      }}
                    >
                      {filter}
                    </button>
                  ))}
                </div>

                <div className="budget-jar-strip" aria-label="Các mục ngân sách">
                  <button
                    type="button"
                    className="jar-arrow budget-arrow"
                    aria-label="Mục ngân sách trước"
                    disabled={budgetJarIndices.length <= 1 || Boolean(pendingJar)}
                    onClick={() => {
                      const currentPosition = budgetJarIndices.indexOf(safeBudgetIndex)
                      const nextPosition = isBudgetJarActive && currentPosition >= 0
                        ? (currentPosition - 1 + budgetJarIndices.length) % budgetJarIndices.length
                        : budgetJarIndices.length - 1
                      beginJarTransition('budget', budgetJarIndices[nextPosition], 'left')
                    }}
                  >←</button>

                  <div className="budget-bubble-row" aria-label="Các mục ngân sách">
                    {visibleBudgetBubbles.map((budgetBubble, index) => (
                      <button
                        key={budgetBubble.type === 'create' ? 'create-budget' : budgetBubble.id}
                        type="button"
                        draggable={budgetBubble.type === 'budget'}
                        disabled={Boolean(pendingJar)}
                        className={`budget-bubble${budgetBubble.type === 'create' ? ' create' : ''}${budgetBubble.type === 'overflow' ? ' overflow' : ''}${isBudgetJarActive && index === safeBudgetIndex ? ' active' : ''}`}
                        style={{ background: budgetBubble.tone }}
                        onDragStart={(event) => {
                          if (budgetBubble.type !== 'budget') return
                          budgetDropHandled.current = false
                          setDraggedBudgetCategory(budgetBubble.category)
                          setDraggedBudgetId(budgetBubble.budgetId ?? null)
                          event.dataTransfer.setData('text/plain', budgetBubble.category)
                          event.dataTransfer.effectAllowed = 'move'
                        }}
                        onDragEnd={() => {
                          setDraggedBudgetCategory(null)
                          setDraggedBudgetId(null)
                          if (!budgetDropHandled.current) setOpenJarKey(null)
                          budgetDropHandled.current = false
                        }}
                        onClick={() => {
                          if (budgetBubble.type === 'create') {
                            setPage('budgets')
                            setEditingBudgetId(null)
                            setBudgetCategory('')
                            setBudgetLimit('')
                            setBudgetMonth(currentMonth())
                            return
                          }

                          if (budgetBubble.type === 'overflow') {
                            setPage('budgets')
                            return
                          }

                          beginJarTransition('budget', index, index > safeBudgetIndex ? 'right' : 'left')
                        }}
                      >
                        <span className="budget-bubble-jar" aria-hidden="true">
                          <span className="budget-jar-lid" />
                          <span className="budget-jar-body" />
                        </span>
                        <span className="budget-bubble-label">{budgetBubble.label}</span>
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="jar-arrow budget-arrow"
                    aria-label="Mục ngân sách tiếp theo"
                    disabled={budgetJarIndices.length <= 1 || Boolean(pendingJar)}
                    onClick={() => {
                      const currentPosition = budgetJarIndices.indexOf(safeBudgetIndex)
                      const nextPosition = isBudgetJarActive && currentPosition >= 0
                        ? (currentPosition + 1) % budgetJarIndices.length
                        : 0
                      beginJarTransition('budget', budgetJarIndices[nextPosition], 'right')
                    }}
                  >→</button>
                </div>

                <div className="home-jar-stage">
                  {!isBudgetJarActive && previousSource && <div className="side-jar side-jar-previous"><MiniJar source={previousSource} balance={sourceBalance(previousSource)} /></div>}
                  <div
                    key={isBudgetJarActive ? activeBudgetDetail?.id ?? activeBudgetDetail?.category ?? 'budget-jar' : activeSource?.id ?? 'source-jar'}
                    className={`featured-jar${pendingJar ? ` exit-${pendingJar.direction === 'right' ? 'left' : 'right'}` : jarMotionDirection ? ` ${jarMotionDirection}` : ''}${isBudgetJarActive ? ' budget-featured-jar' : ''}${isActiveJarOpen ? ' open' : ''}`}
                    onAnimationEnd={(event) => {
                      if (!pendingJar || !event.animationName.startsWith('budget-jar-exit-')) return
                      setJarMotionDirection(null)
                      setIsBudgetJarActive(pendingJar.type === 'budget')
                      if (pendingJar.type === 'budget') setActiveBudgetIndex(pendingJar.index)
                      else {
                        if (pendingJar.sourceFilter) setSourceFilter(pendingJar.sourceFilter)
                        setActiveSourceIndex(pendingJar.index)
                      }
                      setPendingJar(null)
                    }}
                    onDragEnter={() => {
                      if (canReceiveDraggedBudget) setOpenJarKey(activeJarKey)
                    }}
                    onDragOver={(event) => {
                      if (canReceiveDraggedBudget) {
                        event.preventDefault()
                        setOpenJarKey(activeJarKey)
                      } else {
                        setOpenJarKey((openKey) => openKey === activeJarKey ? null : openKey)
                      }
                    }}
                    onDrop={(event) => {
                      if (!canReceiveDraggedBudget || !draggedBudget) return
                      event.preventDefault()
                      budgetDropHandled.current = true
                      setBudgetExpenseTarget(draggedBudget)
                      setBudgetExpenseAmount('')
                      setOpenJarKey(activeJarKey)
                    }}
                    onDragLeave={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                        setOpenJarKey((openKey) => openKey === activeJarKey ? null : openKey)
                      }
                    }}
                  >
                    <div className="mochi-jar-illustration" aria-hidden="true">
                      <span className={`jar-lid${isActiveJarOpen ? ' open' : ''}`} />
                      <span className="jar-glass">
                        {Array.from({ length: isBudgetJarActive && activeBudgetDetail ? budgetMochiCount(activeBudgetDetail) : 6 }, (_, index) => (
                          <i key={index}>🍡</i>
                        ))}
                      </span>
                      {mochiDropId > 0 && <span key={mochiDropId} className="falling-mochi" onAnimationEnd={() => setMochiDropId(0)}>🍡</span>}
                    </div>
                    <p className="featured-jar-type">{isBudgetJarActive ? 'NGÂN SÁCH' : activeSource?.type ?? 'NGUỒN TIỀN'}</p>
                    <h3>{isBudgetJarActive ? activeBudgetDetail?.category : activeSource?.name ?? 'Hũ đầu tiên của bạn'}</h3>
                    <strong className="featured-jar-balance">{formatMoney(isBudgetJarActive && activeBudgetDetail ? remainingForBudget(activeBudgetDetail) : activeSource ? sourceBalance(activeSource) : 0)}</strong>
                    {!isBudgetJarActive && !activeSource && <button className="primary-button" type="button" onClick={() => setPage('sources')}>Tạo nguồn tiền</button>}
                  </div>

                  {pendingJar && (
                    <div
                      key={`incoming-${pendingJar.type}-${pendingJar.index}-${pendingJar.sourceFilter ?? ''}`}
                      className={`featured-jar entering ${pendingJar.direction}`}
                      aria-hidden="true"
                    >
                      <div className="mochi-jar-illustration">
                        <span className="jar-lid" />
                        <span className="jar-glass">
                          <i>🍡</i><i>🍡</i><i>🍡</i><i>🍡</i><i>🍡</i><i>🍡</i>
                        </span>
                      </div>
                      <p className="featured-jar-type">{pendingJar.type === 'budget' ? 'NGÂN SÁCH' : incomingSource?.type ?? 'NGUỒN TIỀN'}</p>
                      <h3>{pendingJar.type === 'budget' ? incomingBudget?.category : incomingSource?.name ?? 'Hũ đầu tiên của bạn'}</h3>
                      <strong className="featured-jar-balance">{formatMoney(pendingJar.type === 'budget' ? incomingBudget?.limit ?? 0 : incomingSource ? sourceBalance(incomingSource) : 0)}</strong>
                    </div>
                  )}

                  {budgetExpenseTarget && (
                    <form className="budget-expense-chat" onSubmit={saveBudgetExpense} role="dialog" aria-label="Ghi khoản chi ngân sách">
                      <p>Đã dùng bao nhiêu MO cho mục {budgetExpenseTarget.category}?</p>
                      {moneySources.length === 0 && <p className="budget-expense-chat-notice">Tạo hũ nguồn tiền để lưu giao dịch này.</p>}
                      <label>
                        Số MO đã dùng
                        <input
                          autoFocus
                          required
                          type="number"
                          min="1"
                          step="1"
                          value={budgetExpenseAmount}
                          onChange={(event) => setBudgetExpenseAmount(event.target.value)}
                          placeholder="Nhập số MO"
                        />
                      </label>
                      <div className="budget-expense-chat-actions">
                        <button className="quiet-button" type="button" onClick={() => {
                          setBudgetExpenseTarget(null)
                          setOpenJarKey(null)
                        }}>Hủy</button>
                        {moneySources.length === 0 ? (
                          <button className="primary-button" type="button" onClick={() => {
                            setBudgetExpenseTarget(null)
                            setOpenJarKey(null)
                            setPage('sources')
                          }}>Tạo nguồn</button>
                        ) : (
                          <button className="primary-button" type="submit">Xác nhận</button>
                        )}
                      </div>
                    </form>
                  )}

                  {!isBudgetJarActive && nextSource && <div className="side-jar side-jar-next"><MiniJar source={nextSource} balance={sourceBalance(nextSource)} /></div>}
                </div>
              </section>
            </div>
          ) : pageDetails ? (
            <div className="page-shell">
              <header className="page-heading">
                <div>
                  <h1><span aria-hidden="true">{pageDetails.icon}</span> {pageDetails.label}</h1>
                  <p className="page-description">{pageDetails.description}</p>
                </div>
                <button className="home-link" type="button" onClick={() => setPage('home')}>
                  <span aria-hidden="true">←</span> Trang chủ
                </button>
              </header>

              {error && <div className="app-error" role="alert">{error}</div>}

              {page === 'charts' && (
                <div className="page-content">
                  <section className="content-card">
                    <SectionHeading title="Tổng quan dòng tiền" detail="Thu nhập và chi tiêu được ghi nhận trên thiết bị này." />
                    <div className="summary-grid">
                      <SummaryCard label="Tổng thu nhập" value={formatMoney(totalIncome)} tone="income" />
                      <SummaryCard label="Tổng chi tiêu" value={formatMoney(totalExpense)} tone="expense" />
                      <SummaryCard label="Số dư" value={formatMoney(balance)} tone="balance" />
                    </div>
                  </section>
                  <section className="content-card">
                    <SectionHeading title="Thu và chi" detail="Sáu tháng gần nhất" />
                    <div className="cashflow-legend" aria-hidden="true">
                      <span><i className="income" /> Thu nhập</span>
                      <span><i className="expense" /> Chi tiêu</span>
                    </div>
                    <div className="cashflow-plot" role="group" aria-label="Biểu đồ thu nhập và chi tiêu trong sáu tháng gần nhất">
                      {cashflowMonths.map((month) => (
                        <div
                          className="cashflow-month"
                          key={month.key}
                          tabIndex={0}
                          role="group"
                          aria-label={`${month.label}: thu ${formatMoney(month.income)}, chi ${formatMoney(month.expense)}`}
                        >
                          <div className="cashflow-tooltip" aria-hidden="true">
                            <strong>{month.label}</strong>
                            <span><i className="income" />Thu {formatMoney(month.income)}</span>
                            <span><i className="expense" />Chi {formatMoney(month.expense)}</span>
                          </div>
                          <div className="cashflow-bars">
                            <span
                              className="cashflow-bar income"
                              style={{ height: `${month.income ? Math.max(4, (month.income / cashflowMax) * 100) : 0}%` }}
                              title={`Thu nhập ${formatMoney(month.income)}`}
                            />
                            <span
                              className="cashflow-bar expense"
                              style={{ height: `${month.expense ? Math.max(4, (month.expense / cashflowMax) * 100) : 0}%` }}
                              title={`Chi tiêu ${formatMoney(month.expense)}`}
                            />
                          </div>
                          <span className="cashflow-month-label">{month.label}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                  <section className="content-card">
                    <SectionHeading title="Chi tiêu theo danh mục" detail={`${expenseCategoryTotals.length} danh mục`} />
                    {expenseCategoryTotals.length === 0 ? <EmptyState text="Chưa có khoản chi nào để hiển thị." /> : (
                      <div className="category-chart-list">
                        {expenseCategoryTotals.map(([categoryName, total]) => (
                          <div className="category-chart-row" key={categoryName}>
                            <div><strong>{categoryName}</strong><span>{formatMoney(total)}</span></div>
                            <span className="category-chart-track"><span style={{ width: `${totalExpense ? (total / totalExpense) * 100 : 0}%` }} /></span>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              )}

              {page === 'wardrobe' && (
                <div className="page-content">
                  <section className="mochi-dresser" aria-label="Thiết kế phụ kiện cho Mochi">
                    <header className="mochi-dresser-heading">
                      <div>
                        <p className="dashboard-eyebrow">PHÒNG THAY ĐỒ</p>
                        <h2>Phối đồ cho Mochi</h2>
                      </div>
                      <div className="wardrobe-header-actions">
                        <span className="dresser-level">⭐ {mochiPoints} sao</span>
                        <button className="primary-button wardrobe-save-button" type="button" onClick={saveMochiOutfit} disabled={!outfitHasChanges}>
                          {outfitHasChanges ? 'Lưu Mochi' : 'Đã lưu'}
                        </button>
                      </div>
                    </header>
                    <div className="mochi-dresser-layout">
                      <div className="wardrobe-stage" aria-label="Mochi với màu sắc và phụ kiện đã chọn">
                        {(['hat', 'clip'] as AccessorySlot[]).map((slot) => {
                          const accessory = accessorySlots.find((item) => item.id === slot)?.options.find((item) => item.id === mochiOutfit[slot])
                          return accessory && accessory.id !== 'none'
                            ? <span className={`wardrobe-wearable wardrobe-${slot}`} key={slot}>{accessory.icon}</span>
                            : null
                        })}
                        <div className={`wardrobe-mochi color-${mochiOutfit.color}`}>
                          <span className={`assistant-slime assistant-slime-${mochiOutfit.expression}`} aria-hidden="true">
                            <span className="assistant-slime-eye assistant-slime-eye-left" />
                            <span className="assistant-slime-eye assistant-slime-eye-right" />
                            <span className="assistant-slime-mouth" />
                            <span className="assistant-slime-blush" />
                          </span>
                        </div>
                        <span className="wardrobe-stage-caption">Mochi · cấp 1</span>
                      </div>
                      <div className="wardrobe-tray">
                        {accessorySlots.map((slot) => (
                          <div className="wardrobe-slot" key={slot.id} role="group" aria-label={`Chọn ${slot.label}`}>
                            <h3>{slot.label}</h3>
                            <div className="wardrobe-options">
                              {slot.options.map((option) => (
                                (() => {
                                  const accessoryKey = `${slot.id}:${option.id}`
                                  const owned = !option.cost || unlockedAccessories.includes(accessoryKey)
                                  const canAfford = mochiPoints >= (option.cost ?? 0)
                                  return (
                                    <button
                                      className={`wardrobe-option${mochiOutfit[slot.id] === option.id ? ' active' : ''}${owned ? '' : ' locked'}`}
                                      key={option.id}
                                      type="button"
                                      disabled={!owned && !canAfford}
                                      aria-label={`${slot.label}: ${option.label}${owned ? ', đã sở hữu' : `, giá ${option.cost} sao`}`}
                                      title={owned ? option.label : `Đổi ${option.label} với ${option.cost} sao`}
                                      aria-pressed={mochiOutfit[slot.id] === option.id}
                                      onClick={() => selectAccessory(slot.id, option)}
                                    >
                                      <span aria-hidden="true">{option.icon}</span>
                                      <small>{owned ? option.label : `🔒 ${option.cost} sao`}</small>
                                    </button>
                                  )
                                })()
                              ))}
                            </div>
                          </div>
                        ))}
                        <div className="wardrobe-slot" role="group" aria-label="Chọn màu Mochi">
                          <h3>Màu Mochi</h3>
                          <div className="wardrobe-options wardrobe-color-options">
                            {mochiColors.map((option) => (
                              <button
                                className={`wardrobe-option wardrobe-color-option${mochiOutfit.color === option.id ? ' active' : ''}`}
                                key={option.id}
                                type="button"
                                aria-label={`Màu Mochi: ${option.label}`}
                                aria-pressed={mochiOutfit.color === option.id}
                                onClick={() => updateMochiColor(option.id)}
                              >
                                <span style={{ backgroundColor: option.color }} aria-hidden="true" />
                                <small>{option.label}</small>
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="wardrobe-slot" role="group" aria-label="Chọn biểu cảm Mochi">
                          <h3>Biểu cảm</h3>
                          <div className="wardrobe-options wardrobe-expression-options">
                            {mascotExpressions.map((option) => (
                              <button
                                className={`wardrobe-option wardrobe-expression-option${mochiOutfit.expression === option.id ? ' active' : ''}`}
                                key={option.id}
                                type="button"
                                aria-label={`Biểu cảm: ${option.label}`}
                                aria-pressed={mochiOutfit.expression === option.id}
                                onClick={() => updateMochiExpression(option.id)}
                              >
                                <span aria-hidden="true">{option.icon}</span>
                                <small>{option.label}</small>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              )}

              {page === 'budgets' && (
                <div className="page-content">
                  <section className="content-card">
                    <SectionHeading title={editingBudgetId === null ? 'Tạo ngân sách' : 'Chỉnh sửa ngân sách'} detail="Đặt giới hạn chi tiêu cho từng danh mục." />
                    <form className="form-grid" onSubmit={saveBudget}>
                      <label>Danh mục<input required value={budgetCategory} onChange={(event) => setBudgetCategory(event.target.value)} placeholder="Ví dụ: Ăn uống" /></label>
                      <label>Giới hạn ngân sách (MO)<input required type="number" min="1" value={budgetLimit} onChange={(event) => setBudgetLimit(event.target.value)} placeholder="Nhập số MO" /></label>
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
                      <label>Số MO mục tiêu<input required type="number" min="1" value={goalTargetAmount} onChange={(event) => setGoalTargetAmount(event.target.value)} placeholder="Nhập số MO" /></label>
                      {editingGoalId === null && <label>Đã tiết kiệm<input type="number" min="0" value={goalSavedAmount} onChange={(event) => setGoalSavedAmount(event.target.value)} placeholder="0 MO" /></label>}
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
                                  <label className="saving-input-label">Số MO muốn thêm<input required type="number" min="1" value={savingAmount} onChange={(event) => setSavingAmount(event.target.value)} placeholder="Nhập số MO" /></label>
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
                                <button type="button" className="text-button" onClick={() => createGoalTask(goal)} disabled={goal.id === undefined || goal.taskRewarded || tasks.some((task) => task.goalId === goal.id)}>
                                  {goal.taskRewarded ? 'Đã nhận thưởng' : tasks.some((task) => task.goalId === goal.id) ? 'Đã tạo nhiệm vụ' : 'Tạo nhiệm vụ từ mục tiêu'}
                                </button>
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
                    <div><SectionHeading title="Nhiệm vụ hôm nay" detail="Mỗi nhiệm vụ hoàn thành sẽ tặng bạn sao Mochi." /></div>
                    <button className="primary-button" type="button" onClick={() => setIsTaskFormOpen((open) => !open)}>{isTaskFormOpen ? 'Đóng' : '+ Tạo nhiệm vụ'}</button>
                  </section>
                  {isTaskFormOpen && (
                    <section className="content-card">
                      <SectionHeading title="Nhiệm vụ mới" detail="Tự đặt việc nhỏ và phần thưởng sao." />
                      <form className="form-grid" onSubmit={addTask}>
                        <label>Tên nhiệm vụ<input required maxLength={100} value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Ví dụ: Đọc sách 20 phút" /></label>
                        <label>Sao thưởng<input required type="number" min="1" step="1" value={taskReward} onChange={(event) => setTaskReward(event.target.value)} /></label>
                        <div className="form-actions">
                          <button className="primary-button" type="submit">Tạo nhiệm vụ</button>
                          <button className="quiet-button" type="button" onClick={() => setIsTaskFormOpen(false)}>Hủy</button>
                        </div>
                      </form>
                    </section>
                  )}
                  <section className="dashboard-list-section">
                    <SectionHeading title="Danh sách nhiệm vụ" detail={`${tasks.filter((task) => !task.completed).length} nhiệm vụ cần hoàn thành`} />
                    {tasks.length === 0 ? <EmptyState text="Bạn chưa có nhiệm vụ nào. Tạo nhiệm vụ đầu tiên để bắt đầu nhé!" /> : (
                      <div className="card-list">
                        {tasks.map((task) => (
                          <article className={`content-card task-card${task.completed ? ' task-completed' : ''}`} key={task.id}>
                            <span className="task-check" aria-hidden="true">{task.completed ? '✓' : '○'}</span>
                            <div className="task-copy"><h3>{task.title}</h3><p>{task.completed ? `Đã hoàn thành${task.completedAt ? ' · tự xóa sau 3 ngày' : ''}` : task.goalId !== undefined ? `Tiến độ mục tiêu: ${Math.round(Math.min(100, ((goals.find((goal) => goal.id === task.goalId)?.savedAmount ?? 0) / Math.max(1, goals.find((goal) => goal.id === task.goalId)?.targetAmount ?? 1)) * 100))}%` : `🎁 Hoàn thành để nhận ${task.reward} sao`}</p></div>
                            {!task.completed && task.goalId === undefined && <button className="secondary-button" type="button" onClick={() => completeTask(task)}>Hoàn thành</button>}
                            <button className="text-button danger-text task-delete-button" type="button" onClick={() => deleteTask(task)}>Xóa</button>
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
                      <label>Số dư MO ban đầu<input required type="number" min="0" step="1" value={sourceInitialBalance} onChange={(event) => setSourceInitialBalance(event.target.value)} placeholder="Nhập số MO hiện có" /></label>
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

              {page === 'transactions' && (
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
                      <label>Số MO<input required type="number" min="1" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Nhập số MO" /></label>
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
            </div>
          ) : null}
        </main>

        <button key={pointsPulse} className="task-points-bubble" type="button" onClick={() => setPage('tasks')} aria-label={`${mochiPoints} sao Mochi`} title="Điểm nhiệm vụ">
          <span className="task-points-star" aria-hidden="true">★</span>
          <strong>{mochiPoints}</strong>
          <span className="task-points-unit">sao</span>
          <span className="task-points-spark" aria-hidden="true">✦</span>
        </button>

        <AssistantWidget username={username} isOpen={assistantOpen} onOpenChange={setAssistantOpen} appearance={savedMochiOutfit} />
      </div>
    </>
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

function MiniJar({ source, balance }: { source: MoneySource; balance: number }) {
  return (
    <div className="mini-jar">
      <span className="mini-jar-glass" aria-hidden="true">🍡</span>
      <strong>{source.name}</strong>
      <small>{formatMoney(balance)}</small>
    </div>
  )
}

export default App
