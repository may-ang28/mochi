import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  db,
  type Budget,
  type Goal,
  type GoalContribution,
  type MoneySource,
  type MoneySourceBalanceMode,
  type Task,
  type Transaction,
  type TransactionType,
} from './db'
import AssistantWidget from './AssistantWidget'
import OnboardingGuide from './OnboardingGuide'
import MochiMascot from './MochiMascot'
import { mascotExpressions, type MascotExpression } from './mascot'
import {
  createLocalAccount,
  getLocalAccounts,
  getSignedInAccountStorageKey,
  getSignedInUsername,
  signInLocalAccount,
  signOutLocalAccount,
  verifyLocalAccountPassword,
} from './auth'
import './App.css'

type Page = 'home' | 'charts' | 'wardrobe' | 'budgets' | 'goals' | 'tasks' | 'transactions' | 'sources' | 'settings'
type DashboardIconName = Page | 'assistant'

function DashboardIcon({ name }: { name: DashboardIconName }) {
  return (
    <svg className={`dashboard-icon dashboard-icon-${name}`} viewBox="0 0 28 28" fill="none" aria-hidden="true" focusable="false">
      <circle className="dashboard-icon-backdrop" cx="14" cy="14" r="13" />
      <g className="dashboard-icon-stroke" strokeLinecap="round" strokeLinejoin="round">
        {name === 'home' && <><path d="m6.5 13 7.5-6 7.5 6v8a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1z" /><path d="M11 22v-6h6v6" /></>}
        {name === 'charts' && <><path d="M7 21V14h4v7M12 21V8h4v13M17 21v-9h4v9" /><path d="M6 22h16" /></>}
        {name === 'wardrobe' && <><path d="M14 8a2.5 2.5 0 1 0-2.5-2.5" /><path d="m11.5 6-4.5 4 7 3 7-3-4.5-4" /><path d="m7 10 2 11h10l2-11" /></>}
        {name === 'budgets' && <><path d="M9 6h10l-.7 3H9.7zM9.7 9h8.6l1.3 11a2 2 0 0 1-2 2h-7.2a2 2 0 0 1-2-2z" /><path d="M11 15h6" /></>}
        {name === 'goals' && <><circle cx="14" cy="14" r="8" /><circle cx="14" cy="14" r="4" /><path d="m14 14 7-7M17 7h4v4" /></>}
        {name === 'tasks' && <><rect x="7" y="6" width="14" height="17" rx="2" /><path d="m10 11 1.5 1.5L14 10M16 12h2M10 17l1.5 1.5L14 16M16 18h2" /></>}
        {name === 'transactions' && <><rect x="6" y="7" width="16" height="14" rx="2.5" /><path d="M6 11h16M10 16h3M17 16h1" /><path d="M10 4v3M18 4v3" /></>}
        {name === 'sources' && <><path d="M7 10.5h13a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3h11" /><path d="M17 14h5v4h-5a2 2 0 0 1 0-4z" /><circle cx="17.5" cy="16" r=".5" /></>}
        {name === 'settings' && <><circle cx="14" cy="14" r="3.2" /><path d="m11.5 5.7.5-1h4l.5 1 .2 1.4 1.4.8 1.3-.5 2 3.4-1 1-.8 1.4.2 1.5 1 1-2 3.4-1.4-.4-1.6.4-.8 1.2h-4l-.5-1.2-1.4-.8-1.4.4-2-3.4 1-1 .2-1.5-.8-1.4-1-1 2-3.4 1.4.5 1.4-.8z" /></>}
        {name === 'assistant' && <><path d="M14 5.5 16 11l5.5 2-5.5 2-2 5.5-2-5.5-5.5-2 5.5-2z" /><path d="m20 4 .7 2.1L23 7l-2.3.8L20 10l-.8-2.2L17 7l2.2-.9z" /></>}
      </g>
    </svg>
  )
}

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

const navigation: { id: Page; label: string; icon: DashboardIconName; description: string }[] = [
  { id: 'charts', label: 'Biểu đồ', icon: 'charts', description: 'Tổng quan thu chi MO' },
  { id: 'wardrobe', label: 'Tủ đồ', icon: 'wardrobe', description: 'Chọn phụ kiện cho Mochi' },
  { id: 'budgets', label: 'Ngân sách', icon: 'budgets', description: 'Theo dõi hạn mức chi tiêu' },
  { id: 'goals', label: 'Mục tiêu', icon: 'goals', description: 'Lên kế hoạch tiết kiệm' },
  { id: 'tasks', label: 'Nhiệm vụ', icon: 'tasks', description: 'Hoàn thành việc nhỏ mỗi ngày' },
  { id: 'transactions', label: 'Giao dịch', icon: 'transactions', description: 'Quản lý thu nhập và chi tiêu' },
  { id: 'sources', label: 'Nguồn MO', icon: 'sources', description: 'Theo dõi số dư từng nguồn MO' },
  { id: 'settings', label: 'Cài đặt', icon: 'settings', description: 'Tài khoản và dữ liệu ứng dụng' },
]

const today = () => {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}
const currentMonth = () => today().slice(0, 7)
const formatMoney = (amount: number) => `${amount.toLocaleString('vi-VN')} MO`
const formatIntegerInput = (value: string) => {
  const digits = value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 16)
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
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
const MONEY_SOURCE_TYPES_KEY = 'mochi-money-source-types'
const defaultCategoryOptions = [
  'Ăn uống',
  'Di chuyển',
  'Mua sắm',
  'Hóa đơn',
  'Giải trí',
  'Sức khỏe',
  'Lương',
  'Thưởng',
  'Đầu tư',
  'Khác',
]
const CATEGORY_OPTIONS_KEY = 'mochi-category-options'

const readOptionList = (key: string, defaults: string[], existing: string[] = []) => {
  try {
    const saved = localStorage.getItem(getAccountPreferenceKey(key))
    if (saved === null) {
      return [...new Set([...defaults, ...existing.map((value) => value.trim()).filter(Boolean)])]
    }
    const parsed: unknown = JSON.parse(saved)
    if (!Array.isArray(parsed) || !parsed.every((value) => typeof value === 'string')) {
      return [...defaults]
    }
    return [...new Set(parsed.map((value: string) => value.trim()).filter(Boolean))]
  } catch {
    return [...defaults]
  }
}

const getLocalDateKey = (date = new Date()) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getLocalDateDaysAgo = (days: number) => {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() - days)
  return getLocalDateKey(date)
}

const getCheckInStreak = (dates: string[], currentDate: string) => {
  const checkedInDates = new Set(dates)
  const [year, month, day] = currentDate.split('-').map(Number)
  const date = new Date(year, month - 1, day, 12)
  if (!checkedInDates.has(currentDate)) date.setDate(date.getDate() - 1)
  let streak = 0
  while (checkedInDates.has(getLocalDateKey(date))) {
    streak += 1
    date.setDate(date.getDate() - 1)
  }
  return streak
}

const transactionTypeLabels: Record<TransactionType, string> = {
  income: 'Thu nhập',
  expense: 'Chi tiêu',
  borrow: 'Vay MO',
  repay: 'Trả nợ cá nhân',
  lend: 'Cho mượn',
  collect: 'Thu hồi MO cho mượn',
  cardPayment: 'Trả khoản nợ',
}

const isAssetSource = (source: MoneySource) => source.balanceMode !== 'debt'
const sourceLabel = (source: MoneySource) => source.name.trim() || source.type

const getTransactionAmountSign = (type: TransactionType) =>
  ['income', 'borrow', 'collect'].includes(type) ? '+' : '−'

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
  const [resetPassword, setResetPassword] = useState('')
  const [isResettingData, setIsResettingData] = useState(false)
  const [page, setPage] = useState<Page>('home')
  const [isDashboardOpen, setIsDashboardOpen] = useState(true)
  const [backgroundColor, setBackgroundColor] = useState(getInitialBackgroundColor)
  const [savedMochiOutfit, setSavedMochiOutfit] = useState<MochiOutfit>(readMochiOutfit)
  const [mochiOutfit, setMochiOutfit] = useState<MochiOutfit>(savedMochiOutfit)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [onboardingPending, setOnboardingPending] = useState(false)
  const [onboardingEnabled, setOnboardingEnabled] = useState(false)
  const [onboardingCompletedPages, setOnboardingCompletedPages] = useState<Page[]>([])
  const [activeTourPage, setActiveTourPage] = useState<Page | 'welcome' | null>(null)
  const [isSplashVisible, setIsSplashVisible] = useState(true)
  const [sourceFilter, setSourceFilter] = useState('Tổng')
  const [showHomeFinancialDetails, setShowHomeFinancialDetails] = useState(false)
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
  const touchBudgetDrag = useRef<{ budgetId: number | null; category: string; startX: number; startY: number; moved: boolean } | null>(null)
  const suppressBudgetClick = useRef(false)
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

  const [transactionType, setTransactionType] = useState<TransactionType>('expense')
  const [relatedSourceId, setRelatedSourceId] = useState('')
  const [counterparty, setCounterparty] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(today())
  const [transactionSourceId, setTransactionSourceId] = useState('')
  const [editingTransactionId, setEditingTransactionId] = useState<number | null>(null)

  const [sourceName, setSourceName] = useState('')
  const [sourceType, setSourceType] = useState('')
  const [moneySourceTypes, setMoneySourceTypes] = useState<string[]>(defaultMoneySourceTypes)
  const [newMoneySourceType, setNewMoneySourceType] = useState('')
  const [editingMoneySourceType, setEditingMoneySourceType] = useState<string | null>(null)
  const [moneySourceTypeDraft, setMoneySourceTypeDraft] = useState('')
  const [categoryOptions, setCategoryOptions] = useState<string[]>(defaultCategoryOptions)
  const [newCategoryOption, setNewCategoryOption] = useState('')
  const [editingCategoryOption, setEditingCategoryOption] = useState<string | null>(null)
  const [categoryOptionDraft, setCategoryOptionDraft] = useState('')
  const [sourceInitialBalance, setSourceInitialBalance] = useState('')
  const [sourceBalanceMode, setSourceBalanceMode] = useState<MoneySourceBalanceMode>('asset')
  const [sourceOpeningDate, setSourceOpeningDate] = useState(today())
  const [editingSourceId, setEditingSourceId] = useState<number | null>(null)
  const [checkInDates, setCheckInDates] = useState<string[]>([])
  const [localToday, setLocalToday] = useState(getLocalDateKey)

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
        setMoneySourceTypes(readOptionList(
          MONEY_SOURCE_TYPES_KEY,
          defaultMoneySourceTypes,
          allMoneySources.map((source) => source.type),
        ))
        setCategoryOptions(readOptionList(
          CATEGORY_OPTIONS_KEY,
          defaultCategoryOptions,
          allTransactions.filter((transaction) => !transaction.isOpeningBalance).map((transaction) => transaction.category),
        ))
        setMochiPoints(savedPoints?.total ?? 0)
        setCheckInDates(savedPoints?.checkInDates ?? [])
        setOnboardingEnabled(savedPoints?.onboardingEnabled ?? false)
        setOnboardingCompletedPages(
          (savedPoints?.onboardingCompletedPages ?? [])
            .filter((savedPage) => savedPage === 'home' || navigation.some((item) => item.id === savedPage)) as Page[],
        )
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

  useEffect(() => {
    const timer = window.setInterval(() => setLocalToday(getLocalDateKey()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!onboardingPending || isDataLoading || isSplashVisible) return
    const timer = window.setTimeout(() => {
      setActiveTourPage('welcome')
      setOnboardingPending(false)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [isDataLoading, isSplashVisible, onboardingPending])

  useEffect(() => {
    if (
      !onboardingEnabled ||
      onboardingPending ||
      isDataLoading ||
      isSplashVisible ||
      onboardingCompletedPages.includes(page)
    ) return
    if (page !== 'home' && !onboardingCompletedPages.includes('home')) return

    const timer = window.setTimeout(() => setActiveTourPage(page), 0)
    return () => window.clearTimeout(timer)
  }, [isDataLoading, isSplashVisible, onboardingCompletedPages, onboardingEnabled, onboardingPending, page])

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
        const pointsRecord = await db.points.get(1)
        await db.points.put({
          ...pointsRecord,
          id: 1,
          total: pointsRecord?.total ?? 0,
          unlockedAccessories: pointsRecord?.unlockedAccessories ?? [],
          checkInDates: pointsRecord?.checkInDates ?? [],
          onboardingEnabled: true,
          onboardingCompletedPages: [],
        })
        setIsDataLoading(true)
        setUsername(normalizedName)
        setOnboardingPending(true)
        setOnboardingEnabled(true)
        setOnboardingCompletedPages([])
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
    setOnboardingPending(false)
    setOnboardingEnabled(false)
    setOnboardingCompletedPages([])
    setActiveTourPage(null)
    setAuthMode('signin')
    setAuthName('')
    setAuthPassword('')
    setAllowPasswordManager(false)
    setAuthError('')
  }

  const resetAccountData = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!username || !resetPassword || isResettingData) return

    setError('')
    setIsResettingData(true)
    void (async () => {
      try {
        await verifyLocalAccountPassword(username, resetPassword)
        const confirmed = window.confirm(
          'Thao tác này sẽ xóa toàn bộ giao dịch, nguồn MO, ngân sách, mục tiêu, nhiệm vụ, tiến trình Mochi và các tùy chỉnh của tài khoản hiện tại. Tài khoản và mật khẩu vẫn được giữ lại. Bạn có chắc chắn muốn tiếp tục?',
        )
        if (!confirmed) return

        const accountDataTables = db.tables
        await db.transaction('rw', accountDataTables, async () => {
          await Promise.all(accountDataTables.map((table) => table.clear()))
        })
        const preferenceKeysToReset = [
          BACKGROUND_COLOR_KEY,
          'mochi-outfit',
          MONEY_SOURCE_TYPES_KEY,
          CATEGORY_OPTIONS_KEY,
        ]
        preferenceKeysToReset.forEach((key) => localStorage.removeItem(getAccountPreferenceKey(key)))
        setResetPassword('')
        window.location.reload()
      } catch (resetError) {
        setError(resetError instanceof Error ? resetError.message : 'Không thể đặt lại dữ liệu Mochi.')
      } finally {
        setResetPassword('')
        setIsResettingData(false)
      }
    })()
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

  const completeOnboardingPage = (completedPage: Page) => {
    setActiveTourPage(null)
    void runAction(async () => {
      let completedPages: Page[] = []
      await db.transaction('rw', db.points, async () => {
        const pointsRecord = await db.points.get(1)
        const savedPages = (pointsRecord?.onboardingCompletedPages ?? [])
          .filter((savedPage): savedPage is Page =>
            savedPage === 'home' || navigation.some((item) => item.id === savedPage),
          )
        completedPages = [...new Set([...savedPages, completedPage])]
        await db.points.put({
          ...pointsRecord,
          id: 1,
          total: pointsRecord?.total ?? 0,
          unlockedAccessories: pointsRecord?.unlockedAccessories ?? [],
          onboardingEnabled: pointsRecord?.onboardingEnabled ?? true,
          onboardingCompletedPages: completedPages,
        })
      })
      setOnboardingCompletedPages(completedPages)
    })
  }

  const checkInToday = () => {
    void runAction(async () => {
      let savedDates: string[] = []
      await db.transaction('rw', db.points, async () => {
        const pointsRecord = await db.points.get(1)
        savedDates = pointsRecord?.checkInDates ?? []
        if (savedDates.includes(localToday)) return
        savedDates = [...savedDates, localToday].slice(-400)
        await db.points.put({
          ...pointsRecord,
          id: 1,
          total: pointsRecord?.total ?? 0,
          unlockedAccessories: pointsRecord?.unlockedAccessories ?? [],
          checkInDates: savedDates,
        })
      })
      setCheckInDates(savedDates)
    })
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
      const value = Number(amount)
      if (!Number.isSafeInteger(value) || value <= 0) {
        throw new Error('Số MO cần là số nguyên lớn hơn 0.')
      }
      const sourceId = Number(transactionSourceId)
      const source = moneySources.find((item) => item.id === sourceId)
      if (!source) throw new Error('Hãy chọn một nguồn MO hợp lệ cho giao dịch.')

      const needsCounterparty = ['borrow', 'repay', 'lend', 'collect'].includes(transactionType)
      const normalizedCounterparty = counterparty.trim()
      if (needsCounterparty && !normalizedCounterparty) {
        throw new Error('Hãy nhập tên người liên quan đến khoản vay hoặc cho mượn.')
      }
      if (transactionType === 'cardPayment') {
        const debtSourceId = Number(relatedSourceId)
        const debtSource = moneySources.find((item) => item.id === debtSourceId && item.balanceMode === 'debt')
        if (!isAssetSource(source) || !debtSource) {
          throw new Error('Hãy chọn nguồn MO thanh toán và khoản nợ hợp lệ.')
        }
        const editedPayment = transactions.find((item) =>
          item.id === editingTransactionId &&
          item.type === 'cardPayment' &&
          item.relatedSourceId === debtSourceId,
        )
        if (value > sourceBalance(debtSource) + (editedPayment?.amount ?? 0)) {
          throw new Error('Số MO trả vượt quá khoản nợ hiện tại.')
        }
      } else if (transactionType !== 'expense' && !isAssetSource(source)) {
        throw new Error('Hãy chọn nguồn MO có sẵn cho loại giao dịch này.')
      }

      const normalizePerson = (name: string) => name.trim().toLocaleLowerCase('vi-VN')
      if (transactionType === 'repay' || transactionType === 'collect') {
        const sourceType = transactionType === 'repay' ? 'borrow' : 'lend'
        const settlementType = transactionType === 'repay' ? 'repay' : 'collect'
        const outstanding = transactions
          .filter((item) =>
            item.counterparty &&
            normalizePerson(item.counterparty) === normalizePerson(normalizedCounterparty) &&
            (item.type === sourceType || item.type === settlementType) &&
            item.id !== editingTransactionId,
          )
          .reduce((sum, item) => sum + (item.type === sourceType ? item.amount : -item.amount), 0)
        if (value > outstanding) {
          throw new Error(`Số MO vượt quá khoản ${transactionType === 'repay' ? 'nợ' : 'cho mượn'} còn lại.`)
        }
      }

      const transaction = {
        type: transactionType,
        amount: value,
        category: category.trim(),
        note: note.trim(),
        date,
        sourceId,
        ...(needsCounterparty ? { counterparty: normalizedCounterparty } : {}),
        ...(transactionType === 'cardPayment' ? { relatedSourceId: Number(relatedSourceId) } : {}),
      }

      if (editingTransactionId === null) {
        await db.transactions.add(transaction)
      } else {
        await db.transactions.put({ ...transaction, id: editingTransactionId })
      }
      await refreshTransactions()
      setEditingTransactionId(null)
      setAmount('')
      setCategory('')
      setNote('')
      setDate(today())
      setTransactionSourceId('')
      setRelatedSourceId('')
      setCounterparty('')
    })
  }

  const saveBudgetExpense = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!budgetExpenseTarget) return
    void runAction(async () => {
      const value = Number(budgetExpenseAmount)
      if (!Number.isSafeInteger(value) || value <= 0) {
        throw new Error('Số MO cần là số nguyên lớn hơn 0.')
      }
      const sourceId = (activeSource && isAssetSource(activeSource) ? activeSource : moneySources.find(isAssetSource))?.id
      if (sourceId === undefined) {
        throw new Error('Hãy tạo nguồn MO có sẵn trước khi ghi khoản chi này.')
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
      const jarKey = activeJarKey
      setOpenJarKey(jarKey)
      window.setTimeout(() => setOpenJarKey((openKey) => openKey === jarKey ? null : openKey), 900)
    })
  }

  const editTransaction = (transaction: Transaction) => {
    setEditingTransactionId(transaction.id ?? null)
    setTransactionType(transaction.type)
    setRelatedSourceId(transaction.relatedSourceId === undefined ? '' : String(transaction.relatedSourceId))
    setCounterparty(transaction.counterparty ?? '')
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
        balanceMode: sourceBalanceMode,
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(sourceOpeningDate)) {
        throw new Error('Hãy chọn ngày bắt đầu hợp lệ.')
      }
      if (!Number.isSafeInteger(source.initialBalance)) {
        throw new Error('Số dư ban đầu cần là số MO nguyên hợp lệ.')
      }
      let createdSourceId: number | undefined

      await db.transaction('rw', db.moneySources, db.transactions, async () => {
        if (editingSourceId === null) {
          createdSourceId = await db.moneySources.add(source)
          if (source.initialBalance !== 0) {
            const openingBalanceTransactionId = await db.transactions.add({
              type: source.initialBalance > 0 ? 'income' : 'expense',
              amount: Math.abs(source.initialBalance),
              category: 'Số dư ban đầu',
              note: `Số dư ban đầu · ${sourceLabel(source)}`,
              date: sourceOpeningDate,
              sourceId: createdSourceId,
              isOpeningBalance: true,
            })
            await db.moneySources.update(createdSourceId, { openingBalanceTransactionId })
          }
        } else {
          const existingSource = await db.moneySources.get(editingSourceId)
          if (!existingSource) throw new Error('Không tìm thấy nguồn MO.')

          let openingBalanceTransactionId = existingSource.openingBalanceTransactionId
          if (source.initialBalance !== 0) {
            const openingBalance = {
              type: source.initialBalance > 0 ? 'income' as const : 'expense' as const,
              amount: Math.abs(source.initialBalance),
              category: 'Số dư ban đầu',
              note: `Số dư ban đầu · ${sourceLabel(source)}`,
              date: sourceOpeningDate,
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
      setSourceBalanceMode('asset')
      setSourceOpeningDate(today())
    })
  }

  const editMoneySource = (source: MoneySource) => {
    setEditingSourceId(source.id ?? null)
    setSourceName(source.name)
    setSourceType(source.type)
    setSourceInitialBalance(String(source.initialBalance))
    setSourceBalanceMode(source.balanceMode ?? 'asset')
    setSourceOpeningDate(
      transactions.find((transaction) => transaction.id === source.openingBalanceTransactionId)?.date ?? today(),
    )
  }

  const persistMoneySourceTypes = (nextTypes: string[]) => {
    try {
      localStorage.setItem(getAccountPreferenceKey(MONEY_SOURCE_TYPES_KEY), JSON.stringify(nextTypes))
      setMoneySourceTypes(nextTypes)
      setError('')
    } catch {
      setError('Không thể lưu các lựa chọn loại nguồn trên thiết bị này.')
    }
  }

  const addMoneySourceType = () => {
    const newType = newMoneySourceType.trim()
    if (!newType) return
    if (moneySourceTypes.some((type) => type.toLocaleLowerCase('vi-VN') === newType.toLocaleLowerCase('vi-VN'))) {
      setError('Lựa chọn loại nguồn này đã tồn tại.')
      return
    }
    persistMoneySourceTypes([...moneySourceTypes, newType])
    setSourceType(newType)
    setNewMoneySourceType('')
  }

  const saveMoneySourceTypeEdit = () => {
    const newType = moneySourceTypeDraft.trim()
    if (editingMoneySourceType === null || !newType) return
    if (moneySourceTypes.some((type) =>
      type !== editingMoneySourceType &&
      type.toLocaleLowerCase('vi-VN') === newType.toLocaleLowerCase('vi-VN'),
    )) {
      setError('Lựa chọn loại nguồn này đã tồn tại.')
      return
    }
    persistMoneySourceTypes(moneySourceTypes.map((type) => type === editingMoneySourceType ? newType : type))
    if (sourceType === editingMoneySourceType) setSourceType(newType)
    setEditingMoneySourceType(null)
    setMoneySourceTypeDraft('')
  }

  const deleteMoneySourceType = (typeToDelete: string) => {
    persistMoneySourceTypes(moneySourceTypes.filter((type) => type !== typeToDelete))
    if (sourceType === typeToDelete) setSourceType('')
    if (editingMoneySourceType === typeToDelete) {
      setEditingMoneySourceType(null)
      setMoneySourceTypeDraft('')
    }
  }

  const persistCategoryOptions = (nextOptions: string[]) => {
    try {
      localStorage.setItem(getAccountPreferenceKey(CATEGORY_OPTIONS_KEY), JSON.stringify(nextOptions))
      setCategoryOptions(nextOptions)
      setError('')
    } catch {
      setError('Không thể lưu các gợi ý danh mục trên thiết bị này.')
    }
  }

  const addCategoryOption = () => {
    const newOption = newCategoryOption.trim()
    if (!newOption) return
    if (categoryOptions.some((option) => option.toLocaleLowerCase('vi-VN') === newOption.toLocaleLowerCase('vi-VN'))) {
      setError('Gợi ý danh mục này đã tồn tại.')
      return
    }
    persistCategoryOptions([...categoryOptions, newOption])
    setCategory(newOption)
    setNewCategoryOption('')
  }

  const saveCategoryOptionEdit = () => {
    const newOption = categoryOptionDraft.trim()
    if (editingCategoryOption === null || !newOption) return
    if (categoryOptions.some((option) =>
      option !== editingCategoryOption &&
      option.toLocaleLowerCase('vi-VN') === newOption.toLocaleLowerCase('vi-VN'),
    )) {
      setError('Gợi ý danh mục này đã tồn tại.')
      return
    }
    persistCategoryOptions(categoryOptions.map((option) => option === editingCategoryOption ? newOption : option))
    if (category === editingCategoryOption) setCategory(newOption)
    setEditingCategoryOption(null)
    setCategoryOptionDraft('')
  }

  const deleteCategoryOption = (optionToDelete: string) => {
    persistCategoryOptions(categoryOptions.filter((option) => option !== optionToDelete))
    if (category === optionToDelete) setCategory('')
    if (editingCategoryOption === optionToDelete) {
      setEditingCategoryOption(null)
      setCategoryOptionDraft('')
    }
  }

  const deleteMoneySource = (id: number) => {
    void runAction(async () => {
      const linkedTransactions = (await db.transactions.toArray())
        .filter((transaction) => transaction.sourceId === id || transaction.relatedSourceId === id)
      if (linkedTransactions.some((transaction) => !transaction.isOpeningBalance)) {
        throw new Error('Không thể xóa nguồn MO đã có giao dịch. Hãy giữ lại để bảo toàn lịch sử số dư.')
      }

      await db.transaction('rw', db.moneySources, db.transactions, async () => {
        await db.transactions.bulkDelete(linkedTransactions.map((transaction) => transaction.id!))
        await db.moneySources.delete(id)
      })
      await Promise.all([refreshMoneySources(), refreshTransactions()])
      if (transactionSourceId === String(id)) setTransactionSourceId('')
      if (relatedSourceId === String(id)) setRelatedSourceId('')
    })
  }

  const saveBudget = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void runAction(async () => {
      const limit = Number(budgetLimit)
      if (!Number.isSafeInteger(limit) || limit <= 0) {
        throw new Error('Hạn mức ngân sách cần là số MO nguyên lớn hơn 0.')
      }
      const budget = { category: budgetCategory.trim(), limit, month: budgetMonth }
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
      const targetAmount = Number(goalTargetAmount)
      const savedAmount = Number(goalSavedAmount) || 0
      if (!Number.isSafeInteger(targetAmount) || targetAmount <= 0 || !Number.isSafeInteger(savedAmount) || savedAmount < 0) {
        throw new Error('Số MO mục tiêu và số đã tiết kiệm cần là số nguyên không âm; mục tiêu phải lớn hơn 0.')
      }
      const goal = {
        name: goalName.trim(),
        targetAmount,
        savedAmount,
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
      if (!savingDate) throw new Error('Hãy chọn ngày thêm MO.')
      const sourceId = Number(savingSourceId)
      if (!moneySources.some((source) => source.id === sourceId && isAssetSource(source))) {
        throw new Error('Hãy chọn một nguồn MO hợp lệ cho khoản tiết kiệm.')
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
            throw new Error('Không tìm thấy lần thêm MO cần chỉnh sửa.')
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
    .filter((transaction) => transaction.type === 'income' && !transaction.isOpeningBalance)
    .reduce((sum, transaction) => sum + transaction.amount, 0)
  const totalExpense = transactions
    .filter((transaction) => transaction.type === 'expense' && !transaction.isOpeningBalance)
    .reduce((sum, transaction) => sum + transaction.amount, 0)
  const outstandingCounterparties = [...transactions.reduce((balances, transaction) => {
    if (!transaction.counterparty) return balances
    const key = transaction.counterparty.trim().toLocaleLowerCase('vi-VN')
    const entry = balances.get(key) ?? { name: transaction.counterparty.trim(), borrowed: 0, lent: 0 }
    if (transaction.type === 'borrow') entry.borrowed += transaction.amount
    if (transaction.type === 'repay') entry.borrowed -= transaction.amount
    if (transaction.type === 'lend') entry.lent += transaction.amount
    if (transaction.type === 'collect') entry.lent -= transaction.amount
    balances.set(key, entry)
    return balances
  }, new Map<string, { name: string; borrowed: number; lent: number }>()).values()]
  const sourceBalance = (source: MoneySource) => {
    const balance = source.initialBalance + transactions.reduce((sum, transaction) => {
      if (transaction.isOpeningBalance) return sum
      if (source.balanceMode === 'debt') {
        if (transaction.relatedSourceId === source.id && transaction.type === 'cardPayment') {
          return sum - transaction.amount
        }
        if (transaction.sourceId !== source.id) return sum
        if (transaction.type === 'expense') return sum + transaction.amount
        if (transaction.type === 'income') return sum - transaction.amount
        return sum
      }
      if (transaction.sourceId !== source.id) return sum
      if (['income', 'borrow', 'collect'].includes(transaction.type)) return sum + transaction.amount
      if (['expense', 'repay', 'lend', 'cardPayment'].includes(transaction.type)) return sum - transaction.amount
      return sum
    }, 0)
    return source.balanceMode === 'debt' ? Math.max(0, balance) : balance
  }
  const isSourceDebt = (source: MoneySource) => source.balanceMode === 'debt' || sourceBalance(source) < 0
  const sourceDisplayBalance = (source: MoneySource) =>
    isSourceDebt(source) ? Math.abs(sourceBalance(source)) : sourceBalance(source)
  const sourceLabelById = (sourceId: number | undefined, fallback: string) => {
    const source = moneySources.find((item) => item.id === sourceId)
    return source ? sourceLabel(source) : fallback
  }
  const negativeSourceDebtTotal = moneySources
    .filter(isAssetSource)
    .reduce((sum, source) => sum + Math.max(0, -sourceBalance(source)), 0)
  const cardDebtTotal = moneySources
    .filter((source) => source.balanceMode === 'debt')
    .reduce((sum, source) => sum + Math.max(0, sourceBalance(source)), 0)
  const personalDebtTotal = outstandingCounterparties
    .reduce((sum, person) => sum + Math.max(0, person.borrowed), 0)
  const totalDebt = cardDebtTotal + negativeSourceDebtTotal + personalDebtTotal
  const totalLent = outstandingCounterparties
    .reduce((sum, person) => sum + Math.max(0, person.lent), 0)
  const netWorth = moneySources.reduce(
    (sum, source) => sum + (source.balanceMode === 'debt' ? -sourceBalance(source) : sourceBalance(source)),
    0,
  )
  const sourceTransactionCount = (sourceId: number) =>
    transactions.filter((transaction) =>
      transaction.sourceId === sourceId || transaction.relatedSourceId === sourceId,
    ).length
  const sourceActivityCount = (sourceId: number) =>
    transactions.filter((transaction) =>
      (transaction.sourceId === sourceId || transaction.relatedSourceId === sourceId) &&
      !transaction.isOpeningBalance,
    ).length
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
  const checkInStreak = getCheckInStreak(checkInDates, localToday)
  const checkedInToday = checkInDates.includes(localToday)
  const recentTransactions = transactions
    .filter((transaction) =>
      !transaction.isOpeningBalance &&
      transaction.date >= getLocalDateDaysAgo(3) &&
      transaction.date < localToday,
    )
    .sort((first, second) => second.date.localeCompare(first.date))
    .slice(0, 5)
  const sourceSummaryGroups = [...moneySources.reduce((groups, source) => {
    const mode = source.balanceMode === 'debt' || sourceBalance(source) < 0 ? 'debt' : 'asset'
    const key = `${source.type.trim() || 'Khác'}:${mode}`
    const group = groups.get(key) ?? { type: source.type.trim() || 'Khác', mode, sources: [] as MoneySource[] }
    group.sources.push(source)
    groups.set(key, group)
    return groups
  }, new Map<string, { type: string; mode: MoneySourceBalanceMode; sources: MoneySource[] }>()).values()]
  const availableTransactionSources = transactionType === 'expense'
    ? moneySources
    : moneySources.filter(isAssetSource)
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
      income: monthTransactions.filter((transaction) => transaction.type === 'income' && !transaction.isOpeningBalance).reduce((sum, transaction) => sum + transaction.amount, 0),
      expense: monthTransactions.filter((transaction) => transaction.type === 'expense' && !transaction.isOpeningBalance).reduce((sum, transaction) => sum + transaction.amount, 0),
    }
  })
  const cashflowMax = Math.max(1, ...cashflowMonths.flatMap((month) => [month.income, month.expense]))

  if (!username) {
    return (
      <main className="auth-screen">
        <section className="auth-card">
          <div className="auth-brand">
            <span className="auth-mascot"><MochiMascot /></span>
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
            <span className="auth-mascot"><MochiMascot /></span>
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

        <aside className="mochi-sidebar" id="mochi-navigation" aria-hidden={!isDashboardOpen} data-tour-target={page === 'home' ? 'home-sidebar' : undefined}>
          <button className="mochi-logo-slot mochi-logo-home" type="button" aria-label="Mochi - về trang chủ" onClick={() => setPage('home')}>
            <MochiWordmark compact />
          </button>
          <nav className="sidebar-primary-nav" aria-label="Điều hướng chính">
            <button className={`sidebar-nav-item${page === 'home' ? ' active' : ''}`} type="button" onClick={() => setPage('home')}>
              <span><DashboardIcon name="home" /></span> Home
            </button>
            <button className={`sidebar-nav-item${page === 'charts' ? ' active' : ''}`} type="button" onClick={() => setPage('charts')}>
              <span><DashboardIcon name="charts" /></span> Charts
            </button>
            <button className={`sidebar-nav-item${page === 'wardrobe' ? ' active' : ''}`} type="button" onClick={() => setPage('wardrobe')}>
              <span><DashboardIcon name="wardrobe" /></span> Tủ đồ
            </button>
            <button className="sidebar-nav-item" type="button" onClick={() => setAssistantOpen(true)}>
              <span><DashboardIcon name="assistant" /></span> AI assistant
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
                <span><DashboardIcon name={item.icon} /></span> {item.label}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <button className={`sidebar-nav-item${page === 'settings' ? ' active' : ''}`} type="button" onClick={() => setPage('settings')}>
              <span><DashboardIcon name="settings" /></span> Cài đặt
            </button>
            <button className="sidebar-signout" type="button" onClick={signOut}>Đăng xuất</button>
          </div>
        </aside>

        <main className={`workspace-main${page === 'home' ? ' workspace-main-home' : ''}`}>
          {page === 'home' ? (
            <div className="home-dashboard">
              <section className="home-streak" aria-label="Điểm danh hằng ngày" data-tour-target="home-checkin">
                <span className="streak-mascot"><MochiMascot /></span>
                <div>
                  <strong>{checkInStreak} ngày streak</strong>
                  <span>{checkedInToday ? 'Bạn đã điểm danh hôm nay. Hẹn gặp lại ngày mai!' : 'Điểm danh hôm nay để giữ streak nhé.'}</span>
                </div>
                <div className="streak-dots" aria-hidden="true">
                  {Array.from({ length: 7 }, (_, index) => <span className={index >= 7 - Math.min(checkInStreak, 7) ? 'complete' : ''} key={index} />)}
                </div>
                <button className="check-in-button" type="button" onClick={checkInToday} disabled={checkedInToday}>
                  {checkedInToday ? 'Đã điểm danh' : 'Điểm danh'}
                </button>
              </section>

              <section className={`home-summary-grid${showHomeFinancialDetails ? ' expanded' : ''}`} aria-label="Tổng quan tài chính" data-tour-target="home-summary">
                <SummaryCard label="Tổng thu MO" value={formatMoney(totalIncome)} tone="income" />
                <SummaryCard label="Tổng chi MO" value={formatMoney(totalExpense)} tone="expense" />
                <SummaryCard label="Tổng cộng" value={formatMoney(netWorth)} tone="balance" />
                {showHomeFinancialDetails && (
                  <>
                    <SummaryCard label="Nợ MO" value={formatMoney(totalDebt)} tone="debt" />
                    <SummaryCard label="MO cho mượn" value={formatMoney(totalLent)} tone="lent" />
                  </>
                )}
                <button
                  className="home-summary-toggle"
                  type="button"
                  aria-expanded={showHomeFinancialDetails}
                  onClick={() => setShowHomeFinancialDetails((shown) => !shown)}
                >
                  {showHomeFinancialDetails ? 'Ẩn số liệu mở rộng' : 'Xem thêm số liệu'}
                </button>
              </section>

              <section className="home-money-section">
                <header className="home-section-heading">
                  <div>
                    <p className="dashboard-eyebrow">TÀI CHÍNH CỦA BẠN</p>
                    <h2>Những chiếc hũ</h2>
                  </div>
                  <button className="home-add-source" type="button" onClick={() => setPage('sources')}>
                    + Thêm nguồn MO
                  </button>
                </header>

                <div className="source-filters" role="group" aria-label="Lọc nguồn MO">
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

                  <div className="budget-bubble-row" aria-label="Các mục ngân sách" data-tour-target="home-budget-bubbles">
                    {visibleBudgetBubbles.map((budgetBubble, index) => (
                      <button
                        key={budgetBubble.type === 'create' ? 'create-budget' : budgetBubble.id}
                        type="button"
                        draggable={budgetBubble.type === 'budget'}
                        disabled={Boolean(pendingJar)}
                        className={`budget-bubble${budgetBubble.type === 'create' ? ' create' : ''}${budgetBubble.type === 'overflow' ? ' overflow' : ''}${isBudgetJarActive && index === safeBudgetIndex ? ' active' : ''}`}
                        style={{ background: budgetBubble.tone }}
                        onTouchStart={(event) => {
                          if (budgetBubble.type !== 'budget') return
                          const touch = event.changedTouches[0]
                          touchBudgetDrag.current = {
                            budgetId: budgetBubble.budgetId ?? null,
                            category: budgetBubble.category,
                            startX: touch.clientX,
                            startY: touch.clientY,
                            moved: false,
                          }
                          budgetDropHandled.current = false
                          setDraggedBudgetCategory(budgetBubble.category)
                          setDraggedBudgetId(budgetBubble.budgetId ?? null)
                        }}
                        onTouchMove={(event) => {
                          const touchDrag = touchBudgetDrag.current
                          if (!touchDrag) return
                          const touch = event.changedTouches[0]
                          if (Math.hypot(touch.clientX - touchDrag.startX, touch.clientY - touchDrag.startY) > 12) {
                            touchDrag.moved = true
                            event.preventDefault()
                          }
                        }}
                        onTouchEnd={(event) => {
                          const touchDrag = touchBudgetDrag.current
                          touchBudgetDrag.current = null
                          if (!touchDrag) return
                          suppressBudgetClick.current = touchDrag.moved
                          if (touchDrag.moved) {
                            const touch = event.changedTouches[0]
                            const dropTarget = document.elementFromPoint(touch.clientX, touch.clientY)
                            const targetJar = dropTarget?.closest('[data-budget-drop-target]')
                            const droppedBudget = budgets.find((budget) => budget.id === touchDrag.budgetId)
                              ?? budgets.find((budget) => budget.category === touchDrag.category)
                            if (targetJar && droppedBudget && !pendingJar) {
                              budgetDropHandled.current = true
                              setBudgetExpenseTarget(droppedBudget)
                              setBudgetExpenseAmount('')
                              setOpenJarKey(activeJarKey)
                            }
                          }
                          window.setTimeout(() => { suppressBudgetClick.current = false }, 0)
                          setDraggedBudgetCategory(null)
                          setDraggedBudgetId(null)
                        }}
                        onTouchCancel={() => {
                          touchBudgetDrag.current = null
                          setDraggedBudgetCategory(null)
                          setDraggedBudgetId(null)
                          setOpenJarKey(null)
                        }}
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
                          if (suppressBudgetClick.current) {
                            suppressBudgetClick.current = false
                            return
                          }
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
                        {budgetBubble.type === 'budget' && <MochiMascot className="budget-bubble-mochi" />}
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
                    data-tour-target="home-mochi-jar"
                    data-budget-drop-target="true"
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
                          <MochiMascot className="jar-mochi" key={index} />
                        ))}
                        {mochiDropId > 0 && (
                          <MochiMascot key={`falling-${mochiDropId}`} className="falling-mochi" onAnimationEnd={() => setMochiDropId(0)} />
                        )}
                      </span>
                    </div>
                    <p className="featured-jar-type">{isBudgetJarActive ? 'NGÂN SÁCH' : activeSource?.balanceMode === 'debt' ? 'KHOẢN NỢ' : activeSource?.type ?? 'NGUỒN MO'}</p>
                    <h3>{isBudgetJarActive ? activeBudgetDetail?.category : activeSource ? sourceLabel(activeSource) : 'Hũ đầu tiên của bạn'}</h3>
                    <strong className="featured-jar-balance">{formatMoney(isBudgetJarActive && activeBudgetDetail ? remainingForBudget(activeBudgetDetail) : activeSource ? sourceDisplayBalance(activeSource) : 0)}</strong>
                    {!isBudgetJarActive && !activeSource && <button className="primary-button" type="button" onClick={() => setPage('sources')}>Tạo nguồn MO</button>}
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
                          {Array.from({ length: 6 }, (_, index) => <MochiMascot className="jar-mochi" key={index} />)}
                        </span>
                      </div>
                      <p className="featured-jar-type">{pendingJar.type === 'budget' ? 'NGÂN SÁCH' : incomingSource?.balanceMode === 'debt' ? 'KHOẢN NỢ' : incomingSource?.type ?? 'NGUỒN MO'}</p>
                      <h3>{pendingJar.type === 'budget' ? incomingBudget?.category : incomingSource ? sourceLabel(incomingSource) : 'Hũ đầu tiên của bạn'}</h3>
                      <strong className="featured-jar-balance">{formatMoney(pendingJar.type === 'budget' ? incomingBudget?.limit ?? 0 : incomingSource ? sourceDisplayBalance(incomingSource) : 0)}</strong>
                    </div>
                  )}

                  {budgetExpenseTarget && (
                    <form className="budget-expense-chat" onSubmit={saveBudgetExpense} role="dialog" aria-label="Ghi khoản chi ngân sách">
                      <p>Đã dùng bao nhiêu MO cho mục {budgetExpenseTarget.category}?</p>
                      {moneySources.filter(isAssetSource).length === 0 && <p className="budget-expense-chat-notice">Tạo nguồn MO có sẵn để lưu giao dịch này.</p>}
                      <label>
                        Số MO đã dùng
                        <MOAmountInput
                          value={budgetExpenseAmount}
                          onChange={setBudgetExpenseAmount}
                          required
                        />
                      </label>
                      <div className="budget-expense-chat-actions">
                        <button className="quiet-button" type="button" onClick={() => {
                          setBudgetExpenseTarget(null)
                          setOpenJarKey(null)
                        }}>Hủy</button>
                        {moneySources.filter(isAssetSource).length === 0 ? (
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

              <section className="home-source-summary" aria-label="Tổng hợp nguồn MO" data-tour-target="home-source-summary">
                <header className="home-section-heading">
                  <div>
                    <p className="dashboard-eyebrow">TÀI KHOẢN CỦA BẠN</p>
                    <h2>Nguồn MO · {moneySources.length}</h2>
                  </div>
                  <button className="home-add-source" type="button" onClick={() => setPage('sources')}>
                    Quản lý
                  </button>
                </header>
                {sourceSummaryGroups.length === 0 ? (
                  <p className="home-empty-note">Chưa có nguồn MO. Thêm nguồn tiền mặt, tài khoản hoặc thẻ để bắt đầu.</p>
                ) : (
                  <div className="home-source-groups">
                    {sourceSummaryGroups.map((group) => (
                      <article className={`home-source-group${group.mode === 'debt' ? ' debt' : ''}`} key={`${group.type}:${group.mode}`}>
                        <div className="home-source-group-heading">
                          <div>
                            <strong>{group.type}</strong>
                            <span>{group.sources.length} nguồn · {group.mode === 'debt' ? 'khoản nợ' : 'MO có sẵn'}</span>
                          </div>
                          <strong>{formatMoney(group.sources.reduce((sum, source) => sum + sourceDisplayBalance(source), 0))}</strong>
                        </div>
                        <ul>
                          {group.sources.map((source) => (
                            <li key={source.id}>
                              <span>{sourceLabel(source)}</span>
                              <span>{formatMoney(sourceDisplayBalance(source))}</span>
                            </li>
                          ))}
                        </ul>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="home-recent-transactions" aria-label="Giao dịch gần đây" data-tour-target="home-recent">
                <header className="home-section-heading">
                  <div>
                    <p className="dashboard-eyebrow">NHẬT KÝ</p>
                    <h2>Giao dịch gần đây</h2>
                  </div>
                  <span className="home-recent-caption">3 ngày trước</span>
                </header>
                {recentTransactions.length === 0 ? (
                  <p className="home-empty-note">Chưa có giao dịch trong 3 ngày gần đây.</p>
                ) : (
                  <div className="home-recent-list">
                    {recentTransactions.map((transaction) => (
                      <div className="home-recent-row" key={transaction.id}>
                        <span className={`home-recent-icon ${transaction.type}`} aria-hidden="true">
                          {getTransactionAmountSign(transaction.type)}
                        </span>
                        <span className="home-recent-copy">
                          <strong>{transaction.category}</strong>
                          <small>{transaction.date} · {transactionTypeLabels[transaction.type]}</small>
                        </span>
                        <strong className={`home-recent-amount ${transaction.type}`}>
                          {getTransactionAmountSign(transaction.type)}{formatMoney(transaction.amount)}
                        </strong>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          ) : pageDetails ? (
            <div className="page-shell">
              <header className="page-heading">
                <div>
                  <h1><span><DashboardIcon name={pageDetails.icon} /></span> {pageDetails.label}</h1>
                  <p className="page-description">{pageDetails.description}</p>
                </div>
                <button className="home-link" type="button" onClick={() => setPage('home')}>
                  <span aria-hidden="true">←</span> Trang chủ
                </button>
              </header>

              {error && <div className="app-error" role="alert">{error}</div>}

              {page === 'charts' && (
                <div className="page-content">
                  <section className="content-card" data-tour-target="charts-summary">
                    <SectionHeading title="Tổng quan dòng tiền" detail="Thu nhập và chi tiêu được ghi nhận trên thiết bị này." />
                    <div className="summary-grid">
                      <SummaryCard label="Tổng thu MO" value={formatMoney(totalIncome)} tone="income" />
                      <SummaryCard label="Tổng chi MO" value={formatMoney(totalExpense)} tone="expense" />
                      <SummaryCard label="Tổng cộng" value={formatMoney(netWorth)} tone="balance" />
                      <SummaryCard label="Nợ MO" value={formatMoney(totalDebt)} tone="debt" />
                      <SummaryCard label="MO cho mượn" value={formatMoney(totalLent)} tone="lent" />
                    </div>
                  </section>
                  <section className="content-card" data-tour-target="charts-flow">
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
                  <section className="content-card" data-tour-target="charts-categories">
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
                  <section className="mochi-dresser" aria-label="Thiết kế phụ kiện cho Mochi" data-tour-target="wardrobe-stage">
                    <header className="mochi-dresser-heading">
                      <div>
                        <p className="dashboard-eyebrow">CỬA HÀNG & TỦ ĐỒ</p>
                        <h2>Cửa hàng & tủ đồ Mochi</h2>
                      </div>
                      <div className="wardrobe-header-actions">
                        <span className="dresser-level" aria-live="polite">⭐ {mochiPoints} sao Mochi</span>
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
                      <div className="wardrobe-tray" data-tour-target="wardrobe-options">
                        {accessorySlots.map((slot) => (
                          <div className="wardrobe-slot" key={slot.id} role="group" aria-label={`Chọn ${slot.label}`}>
                            <h3>{slot.label}</h3>
                            <div className="wardrobe-options">
                              {slot.options.filter((option) => !option.cost || unlockedAccessories.includes(`${slot.id}:${option.id}`)).map((option) => (
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
                        <div className="wardrobe-slot wardrobe-shop-slot" role="group" aria-label="Cửa hàng phụ kiện đổi bằng sao">
                          <h3>Cửa hàng phụ kiện</h3>
                          <p className="wardrobe-shop-note">Dùng sao từ nhiệm vụ để mua vật phẩm; vật phẩm đã mua có thể dùng lại bất cứ lúc nào.</p>
                          {accessorySlots.map((slot) => (
                            <div className="wardrobe-shop-category" key={slot.id}>
                              <strong>{slot.label}</strong>
                              <div className="wardrobe-options">
                                {slot.options.filter((option) => option.cost).map((option) => {
                                  const accessoryKey = `${slot.id}:${option.id}`
                                  const owned = unlockedAccessories.includes(accessoryKey)
                                  const canAfford = mochiPoints >= (option.cost ?? 0)
                                  return (
                                    <button
                                      className={`wardrobe-option wardrobe-shop-item${owned ? ' owned' : ''}`}
                                      key={option.id}
                                      type="button"
                                      disabled={!owned && !canAfford}
                                      aria-label={`${owned ? 'Đã mua' : 'Mua'} ${option.label}, giá ${option.cost} sao`}
                                      onClick={() => selectAccessory(slot.id, option)}
                                    >
                                      <span aria-hidden="true">{option.icon}</span>
                                      <small>{option.label}</small>
                                      <small>{owned
                                        ? mochiOutfit[slot.id] === option.id ? 'Đang dùng' : 'Đã mua · Trang bị'
                                        : `Mua · ${option.cost} sao`}</small>
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
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
                  <section className="content-card" data-tour-target="budgets-form">
                    <SectionHeading title={editingBudgetId === null ? 'Tạo ngân sách' : 'Chỉnh sửa ngân sách'} detail="Đặt giới hạn chi tiêu cho từng danh mục." />
                    <form className="form-grid" onSubmit={saveBudget}>
                      <label>Danh mục<input required autoCorrect="on" spellCheck list="category-options" value={budgetCategory} onChange={(event) => setBudgetCategory(event.target.value)} placeholder="Ví dụ: Ăn uống" /></label>
                      <datalist id="category-options">{categoryOptions.map((option) => <option key={option} value={option} />)}</datalist>
                      <label>Giới hạn ngân sách (MO)<MOAmountInput value={budgetLimit} onChange={setBudgetLimit} required /></label>
                      <details className="form-advanced">
                        <summary>Tùy chọn nâng cao</summary>
                        <div className="form-advanced-content">
                          <label>Tháng áp dụng<input required type="month" value={budgetMonth} onChange={(event) => setBudgetMonth(event.target.value)} /></label>
                        </div>
                      </details>
                      <div className="form-actions">
                        <button className="primary-button" type="submit">{editingBudgetId === null ? '+ Thêm ngân sách' : 'Lưu thay đổi'}</button>
                        {editingBudgetId !== null && <button className="quiet-button" type="button" onClick={() => { setEditingBudgetId(null); setBudgetCategory(''); setBudgetLimit('') }}>Hủy</button>}
                      </div>
                    </form>
                  </section>
                  <section className="dashboard-list-section" data-tour-target="budgets-list">
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
                  <section className="content-card" data-tour-target="goals-form">
                    <SectionHeading title={editingGoalId === null ? 'Mục tiêu mới' : 'Chỉnh sửa mục tiêu'} detail="Biến kế hoạch tiết kiệm thành từng bước cụ thể." />
                    <form className="form-grid" onSubmit={saveGoal}>
                      <label>Tên mục tiêu<input required autoCorrect="on" spellCheck value={goalName} onChange={(event) => setGoalName(event.target.value)} placeholder="Ví dụ: Mua tai nghe" /></label>
                      <label>Số MO mục tiêu<MOAmountInput value={goalTargetAmount} onChange={setGoalTargetAmount} required /></label>
                      {editingGoalId === null && <label>Đã tiết kiệm (MO)<MOAmountInput value={goalSavedAmount} onChange={setGoalSavedAmount} placeholder="0" /></label>}
                      <details className="form-advanced" open={!goalDeadline}>
                        <summary>Tùy chọn nâng cao</summary>
                        <div className="form-advanced-content">
                          <label>Hạn hoàn thành<input required type="date" value={goalDeadline} onChange={(event) => setGoalDeadline(event.target.value)} /></label>
                        </div>
                      </details>
                      <div className="form-actions">
                        <button className="primary-button" type="submit">{editingGoalId === null ? '+ Thêm mục tiêu' : 'Lưu thay đổi'}</button>
                        {editingGoalId !== null && <button className="quiet-button" type="button" onClick={() => { setEditingGoalId(null); setGoalName(''); setGoalTargetAmount(''); setGoalDeadline('') }}>Hủy</button>}
                      </div>
                    </form>
                  </section>
                  <section className="dashboard-list-section" data-tour-target="goals-list">
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
                                    <strong>Lịch sử thêm MO</strong>
                                    <small>{contributions.length} lần thêm MO</small>
                                  </span>
                                  <span className="history-chevron" aria-hidden="true">⌄</span>
                                </summary>
                                <div className="history-disclosure-content">
                                  {contributions.length === 0 ? <p>Chưa có lần thêm MO nào.</p> : contributions.map((contribution) => (
                                    <div className="goal-contribution-row" key={contribution.id}>
                                      <div className="goal-contribution-details">
                                        <strong>{formatMoney(contribution.amount)}</strong>
                                        <span>{contribution.date} · {moneySources.find((source) => source.id === contribution.sourceId)?.name ?? 'Nguồn MO không còn tồn tại'}</span>
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
                                  <label className="saving-input-label">Số MO muốn thêm<MOAmountInput value={savingAmount} onChange={setSavingAmount} required /></label>
                                  <details className="form-advanced">
                                    <summary>Tùy chọn nâng cao</summary>
                                    <div className="form-advanced-content">
                                      <label className="saving-input-label">Ngày thêm MO<input required type="date" value={savingDate} onChange={(event) => setSavingDate(event.target.value)} /></label>
                                    </div>
                                  </details>
                                  <label className="saving-input-label">Trừ từ nguồn MO
                                    <select required value={savingSourceId} onChange={(event) => setSavingSourceId(event.target.value)}>
                                      <option value="">Chọn nguồn MO</option>
                                      {moneySources.filter(isAssetSource).map((source) => (
                                        <option key={source.id} value={source.id}>
                                          {sourceLabel(source)} · {formatMoney(sourceBalance(source))}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <button className="primary-button" type="submit">{editingContributionId === null ? 'Lưu khoản tiết kiệm' : 'Lưu thay đổi'}</button>
                                  {editingContributionId !== null && <button className="quiet-button" type="button" onClick={() => { setEditingContributionId(null); setSavingAmount(''); setSavingDate(today()); setSavingSourceId('') }}>Hủy</button>}
                                </form>
                              )}
                              <div className="item-actions">
                                <button type="button" className="text-button" onClick={() => { setSavingGoalId(goal.id ?? null); setEditingContributionId(null); setSavingAmount(''); setSavingDate(today()); setSavingSourceId(moneySources.find(isAssetSource)?.id === undefined ? '' : String(moneySources.find(isAssetSource)?.id)) }}>+ Thêm MO</button>
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
                  <section className="content-card task-intro" data-tour-target="tasks-intro">
                    <div><SectionHeading title="Nhiệm vụ hôm nay" detail="Mỗi nhiệm vụ hoàn thành sẽ tặng bạn sao Mochi." /></div>
                    <button className="primary-button" type="button" onClick={() => setIsTaskFormOpen((open) => !open)}>{isTaskFormOpen ? 'Đóng' : '+ Tạo nhiệm vụ'}</button>
                  </section>
                  {isTaskFormOpen && (
                    <section className="content-card">
                      <SectionHeading title="Nhiệm vụ mới" detail="Tự đặt việc nhỏ và phần thưởng sao." />
                      <form className="form-grid" onSubmit={addTask}>
                        <label>Tên nhiệm vụ<input required autoCorrect="on" spellCheck maxLength={100} value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Ví dụ: Đọc sách 20 phút" /></label>
                        <label>Sao thưởng<input required type="number" min="1" step="1" value={taskReward} onChange={(event) => setTaskReward(event.target.value)} /></label>
                        <div className="form-actions">
                          <button className="primary-button" type="submit">Tạo nhiệm vụ</button>
                          <button className="quiet-button" type="button" onClick={() => setIsTaskFormOpen(false)}>Hủy</button>
                        </div>
                      </form>
                    </section>
                  )}
                  <section className="dashboard-list-section" data-tour-target="tasks-list">
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
                  <section className="content-card" data-tour-target="sources-form">
                    <SectionHeading
                      title={editingSourceId === null ? 'Thêm nguồn MO' : 'Chỉnh sửa nguồn MO'}
                      detail="Chọn riêng từng nguồn là MO có sẵn hoặc khoản nợ; nguồn có thể trùng loại."
                    />
                    <form className="form-grid" onSubmit={saveMoneySource}>
                      <label>Tên nguồn MO<input autoCorrect="on" spellCheck maxLength={50} value={sourceName} onChange={(event) => setSourceName(event.target.value)} placeholder="Không bắt buộc" /></label>
                      <label>Loại nguồn
                        <select required value={sourceType} onChange={(event) => setSourceType(event.target.value)}>
                          <option value="">Chọn loại nguồn</option>
                          {!moneySourceTypes.includes(sourceType) && sourceType && <option value={sourceType}>{sourceType}</option>}
                          {moneySourceTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                        </select>
                      </label>
                      <details className="form-advanced">
                        <summary>Tùy chọn nâng cao</summary>
                        <div className="form-advanced-content">
                          <label>Cách tính nguồn MO
                            <select value={sourceBalanceMode} onChange={(event) => setSourceBalanceMode(event.target.value as MoneySourceBalanceMode)}>
                              <option value="asset">MO có sẵn</option>
                              <option value="debt">Khoản nợ</option>
                            </select>
                            <small className="source-accounting-hint">
                              Nguồn nợ: khoản chi tăng nợ; dùng “Trả khoản nợ” để trừ nợ và nguồn MO thanh toán.
                            </small>
                          </label>
                          <label>Ngày ghi nhận số dư ban đầu<input required type="date" value={sourceOpeningDate} onChange={(event) => setSourceOpeningDate(event.target.value)} /></label>
                          <div className="source-type-manager">
                            <strong>Danh sách loại nguồn</strong>
                            <small>Thêm loại mới, hoặc sửa/xóa các lựa chọn gợi ý.</small>
                            {moneySourceTypes.map((type) => (
                              <div className="source-type-option" key={type}>
                                {editingMoneySourceType === type ? (
                                  <>
                                    <input
                                      aria-label="Tên loại nguồn mới"
                                      maxLength={30}
                                      value={moneySourceTypeDraft}
                                      onChange={(event) => setMoneySourceTypeDraft(event.target.value)}
                                    />
                                    <button type="button" className="text-button" onClick={saveMoneySourceTypeEdit}>Lưu</button>
                                    <button type="button" className="text-button" onClick={() => { setEditingMoneySourceType(null); setMoneySourceTypeDraft('') }}>Hủy</button>
                                  </>
                                ) : (
                                  <>
                                    <span>{type}</span>
                                    <button type="button" className="text-button" onClick={() => { setEditingMoneySourceType(type); setMoneySourceTypeDraft(type) }}>Sửa</button>
                                    <button type="button" className="text-button danger-text" onClick={() => deleteMoneySourceType(type)}>Xóa</button>
                                  </>
                                )}
                              </div>
                            ))}
                            <div className="source-type-add">
                              <input
                                aria-label="Thêm loại nguồn"
                                autoCorrect="on"
                                spellCheck
                                maxLength={30}
                                value={newMoneySourceType}
                                onChange={(event) => setNewMoneySourceType(event.target.value)}
                                placeholder="Tên loại nguồn mới"
                              />
                              <button type="button" className="secondary-button" onClick={addMoneySourceType}>Thêm lựa chọn</button>
                            </div>
                          </div>
                        </div>
                      </details>
                      <label>{sourceBalanceMode === 'debt' ? 'Số nợ MO ban đầu' : 'Số dư MO ban đầu'}<MOAmountInput value={sourceInitialBalance} onChange={setSourceInitialBalance} placeholder="0" allowNegative={sourceBalanceMode !== 'debt'} required /></label>
                      {sourceBalanceMode !== 'debt' && <small className="source-accounting-hint">Số dư âm sẽ tự động được tính vào tổng nợ MO.</small>}
                      <div className="form-actions">
                        <button className="primary-button" type="submit">{editingSourceId === null ? '+ Thêm nguồn MO' : 'Lưu thay đổi'}</button>
                        {editingSourceId !== null && <button className="quiet-button" type="button" onClick={() => { setEditingSourceId(null); setSourceName(''); setSourceType(''); setSourceInitialBalance(''); setSourceBalanceMode('asset'); setSourceOpeningDate(today()) }}>Hủy</button>}
                      </div>
                    </form>
                  </section>
                  <section className="dashboard-list-section" data-tour-target="sources-list">
                    <SectionHeading title="Các nguồn MO của bạn" detail={`${moneySources.length} nguồn`} />
                    {moneySources.length === 0 ? <EmptyState text="Chưa có nguồn MO nào. Hãy thêm tiền mặt, thẻ hoặc tài khoản đầu tiên." /> : (
                      <div className="card-list">
                        {moneySources.map((source) => {
                          const linkedTransactions = source.id === undefined ? 0 : sourceTransactionCount(source.id)
                          return (
                            <article className="content-card money-source-card" key={source.id}>
                              <div className="item-heading">
                                <div><h3>{sourceLabel(source)}</h3><p>{source.type}</p></div>
                                <span className="status-pill">{linkedTransactions} giao dịch</span>
                              </div>
                              <div className="money-source-balance">
                                <span>{isSourceDebt(source) ? 'Nợ hiện tại' : 'Số dư hiện tại'}</span>
                                <strong>{formatMoney(sourceDisplayBalance(source))}</strong>
                              </div>
                              <p className="money-source-starting">{source.balanceMode === 'debt' || source.initialBalance < 0 ? 'Nợ ban đầu' : 'Số dư MO ban đầu'}: {formatMoney(Math.abs(source.initialBalance))} · {isSourceDebt(source) ? 'Khoản nợ' : 'MO có sẵn'}</p>
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
                  <section className="content-card" data-tour-target="settings-appearance">
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
                  <section className="content-card" data-tour-target="settings-account">
                    <SectionHeading title="Tài khoản" detail="Hồ sơ Mochi đang dùng trên thiết bị này." />
                    <div className="settings-row"><span>Tên tài khoản</span><strong>{username}</strong></div>
                    <button className="secondary-button" type="button" onClick={signOut}>Đăng xuất</button>
                  </section>
                  <section className="content-card" data-tour-target="settings-data">
                    <SectionHeading title="Dữ liệu" detail="Thông tin nơi lưu dữ liệu Mochi." />
                    <p className="settings-note">Giao dịch, mục tiêu và nguồn MO được lưu trong trình duyệt này. Xóa dữ liệu trang web có thể làm mất các thông tin đó.</p>
                    <div className="settings-reset">
                      <h3>Đặt lại dữ liệu Mochi</h3>
                      <p>Giao dịch, nguồn MO, ngân sách, mục tiêu, nhiệm vụ, tiến trình Mochi và các tùy chỉnh sẽ bị xóa. Tài khoản và mật khẩu đăng nhập vẫn được giữ lại.</p>
                      <form className="settings-reset-form" onSubmit={resetAccountData}>
                        <label>
                          Nhập mật khẩu để xác nhận
                          <input
                            autoComplete="current-password"
                            required
                            type="password"
                            value={resetPassword}
                            onChange={(event) => setResetPassword(event.target.value)}
                            placeholder="Mật khẩu tài khoản hiện tại"
                          />
                        </label>
                        <button className="danger-button" type="submit" disabled={isResettingData || !resetPassword}>
                          {isResettingData ? 'Đang đặt lại…' : 'Xóa toàn bộ dữ liệu'}
                        </button>
                      </form>
                    </div>
                  </section>
                </div>
              )}

              {page === 'transactions' && (
                <div className="page-content">
                  <section className="summary-grid" aria-label="Tổng quan giao dịch">
                    <SummaryCard label="Tổng thu MO" value={formatMoney(totalIncome)} tone="income" />
                    <SummaryCard label="Tổng chi MO" value={formatMoney(totalExpense)} tone="expense" />
                    <SummaryCard label="Tổng cộng" value={formatMoney(netWorth)} tone="balance" />
                    <SummaryCard label="Nợ MO" value={formatMoney(totalDebt)} tone="debt" />
                    <SummaryCard label="MO cho mượn" value={formatMoney(totalLent)} tone="lent" />
                  </section>
                  <section className="content-card" data-tour-target="transactions-form">
                    <SectionHeading title={editingTransactionId === null ? 'Thêm giao dịch' : 'Chỉnh sửa giao dịch'} detail="Ghi lại thu, chi, vay, trả nợ, cho mượn hoặc thanh toán thẻ." />
                    {moneySources.length === 0 && (
                      <div className="source-required-note">
                        <p>Bạn cần tạo ít nhất một nguồn MO trước khi ghi giao dịch.</p>
                        <button className="secondary-button" type="button" onClick={() => setPage('sources')}>Tạo nguồn MO</button>
                      </div>
                    )}
                    <form className="form-grid transaction-form" onSubmit={saveTransaction}>
                      <label>Loại giao dịch
                        <select
                          value={transactionType}
                          onChange={(event) => {
                            setTransactionType(event.target.value as TransactionType)
                            setTransactionSourceId('')
                            setRelatedSourceId('')
                            setCounterparty('')
                          }}
                        >
                          {Object.entries(transactionTypeLabels).map(([type, label]) => (
                            <option key={type} value={type}>{label}</option>
                          ))}
                        </select>
                      </label>
                      <label>Số MO<MOAmountInput value={amount} onChange={setAmount} required /></label>
                      <label>{['borrow', 'repay', 'lend', 'collect'].includes(transactionType) ? 'Nội dung' : 'Danh mục'}<input required autoCorrect="on" spellCheck list="category-options" value={category} onChange={(event) => setCategory(event.target.value)} placeholder={transactionTypeLabels[transactionType]} /></label>
                      <datalist id="category-options">{categoryOptions.map((option) => <option key={option} value={option} />)}</datalist>
                      <details className="form-advanced">
                        <summary>Tùy chọn nâng cao</summary>
                        <div className="form-advanced-content">
                          <label>Ngày<input required type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
                          <label className="full-width">Ghi chú<input autoCorrect="on" spellCheck value={note} onChange={(event) => setNote(event.target.value)} placeholder="Không bắt buộc" /></label>
                          <div className="category-option-manager">
                            <strong>Danh sách gợi ý danh mục</strong>
                            <small>Các gợi ý dùng khi nhập giao dịch hoặc ngân sách; bạn vẫn có thể nhập danh mục khác.</small>
                            {categoryOptions.map((option) => (
                              <div className="category-option-row" key={option}>
                                {editingCategoryOption === option ? (
                                  <>
                                    <input
                                      aria-label="Tên gợi ý danh mục mới"
                                      autoCorrect="on"
                                      spellCheck
                                      maxLength={40}
                                      value={categoryOptionDraft}
                                      onChange={(event) => setCategoryOptionDraft(event.target.value)}
                                    />
                                    <button type="button" className="text-button" onClick={saveCategoryOptionEdit}>Lưu</button>
                                    <button type="button" className="text-button" onClick={() => { setEditingCategoryOption(null); setCategoryOptionDraft('') }}>Hủy</button>
                                  </>
                                ) : (
                                  <>
                                    <span>{option}</span>
                                    <button type="button" className="text-button" onClick={() => { setEditingCategoryOption(option); setCategoryOptionDraft(option) }}>Sửa</button>
                                    <button type="button" className="text-button danger-text" onClick={() => deleteCategoryOption(option)}>Xóa</button>
                                  </>
                                )}
                              </div>
                            ))}
                            <div className="category-option-add">
                              <input
                                aria-label="Thêm gợi ý danh mục"
                                autoCorrect="on"
                                spellCheck
                                maxLength={40}
                                value={newCategoryOption}
                                onChange={(event) => setNewCategoryOption(event.target.value)}
                                placeholder="Tên danh mục mới"
                              />
                              <button type="button" className="secondary-button" onClick={addCategoryOption}>Thêm lựa chọn</button>
                            </div>
                          </div>
                        </div>
                      </details>
                      <label>Nguồn MO
                        <select required value={transactionSourceId} onChange={(event) => setTransactionSourceId(event.target.value)} disabled={availableTransactionSources.length === 0}>
                          <option value="">{availableTransactionSources.length === 0 ? 'Hãy tạo nguồn MO trước' : 'Chọn nguồn MO'}</option>
                          {availableTransactionSources.map((source) => (
                            <option key={source.id} value={source.id}>
                              {sourceLabel(source)} · {isSourceDebt(source) ? 'Nợ' : 'MO'} — {formatMoney(sourceDisplayBalance(source))}
                            </option>
                          ))}
                        </select>
                      </label>
                      {transactionType === 'cardPayment' && (
                        <label>Khoản nợ được trả
                          <select required value={relatedSourceId} onChange={(event) => setRelatedSourceId(event.target.value)}>
                            <option value="">Chọn thẻ hoặc khoản nợ</option>
                            {moneySources.filter((source) => source.balanceMode === 'debt').map((source) => (
                              <option key={source.id} value={source.id}>{sourceLabel(source)} — {formatMoney(sourceDisplayBalance(source))}</option>
                            ))}
                          </select>
                        </label>
                      )}
                      {['borrow', 'repay', 'lend', 'collect'].includes(transactionType) && (
                        <label>
                          {transactionType === 'borrow' || transactionType === 'repay' ? 'Người cho vay / người nhận trả' : 'Người mượn / người trả lại'}
                          <input
                            required
                            autoCorrect="on"
                            spellCheck
                            list={transactionType === 'repay' ? 'borrower-list' : transactionType === 'collect' ? 'lender-list' : undefined}
                            maxLength={50}
                            value={counterparty}
                            onChange={(event) => setCounterparty(event.target.value)}
                            placeholder="Tên người liên quan"
                          />
                          {transactionType === 'repay' && <datalist id="borrower-list">{outstandingCounterparties.filter((person) => person.borrowed > 0).map((person) => <option key={person.name} value={person.name} />)}</datalist>}
                          {transactionType === 'collect' && <datalist id="lender-list">{outstandingCounterparties.filter((person) => person.lent > 0).map((person) => <option key={person.name} value={person.name} />)}</datalist>}
                        </label>
                      )}
                      <div className="form-actions">
                        <button className="primary-button" type="submit" disabled={availableTransactionSources.length === 0}>{editingTransactionId === null ? '+ Thêm giao dịch' : 'Lưu thay đổi'}</button>
                        {editingTransactionId !== null && <button className="quiet-button" type="button" onClick={() => { setEditingTransactionId(null); setAmount(''); setCategory(''); setNote(''); setDate(today()); setTransactionSourceId(''); setRelatedSourceId(''); setCounterparty('') }}>Hủy</button>}
                      </div>
                    </form>
                  </section>
                  <section className="dashboard-list-section">
                    <details className="history-disclosure transaction-history" open data-tour-target="transactions-history">
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
                                <span className={`transaction-icon ${transaction.type}`}>{getTransactionAmountSign(transaction.type)}</span>
                                <div className="transaction-copy"><h3>{transaction.category}</h3><p>{transactionTypeLabels[transaction.type]}{transaction.counterparty ? ` · ${transaction.counterparty}` : ''} · {transaction.date} · {sourceLabelById(transaction.sourceId, 'Chưa chọn nguồn MO')}{transaction.relatedSourceId ? ` → ${sourceLabelById(transaction.relatedSourceId, 'Khoản nợ')}` : ''}</p></div>
                                <strong className={`transaction-amount ${transaction.type}`}>{getTransactionAmountSign(transaction.type)}{formatMoney(transaction.amount)}</strong>
                                {transaction.isOpeningBalance || isGoalContributionTransaction(transaction.id) ? (
                                  <span className="source-delete-note">{transaction.isOpeningBalance ? 'Điều chỉnh tại nguồn MO' : 'Điều chỉnh tại mục tiêu'}</span>
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
        {activeTourPage && !isDataLoading && !isSplashVisible && (
          <OnboardingGuide
            page={activeTourPage}
            onClose={() => activeTourPage === 'welcome'
              ? setActiveTourPage('home')
              : completeOnboardingPage(activeTourPage)}
            onFinish={() => activeTourPage === 'welcome'
              ? setActiveTourPage('home')
              : completeOnboardingPage(activeTourPage)}
          />
        )}
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

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: 'income' | 'expense' | 'balance' | 'debt' | 'lent' }) {
  return <article className={`summary-card ${tone}`}><p>{label}</p><strong>{value}</strong></article>
}

function MOAmountInput({
  value,
  onChange,
  placeholder = 'Nhập số MO',
  required = false,
  allowNegative = false,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  allowNegative?: boolean
}) {
  const isNegative = allowNegative && value.startsWith('-')
  const digits = value.replace(/\D/g, '')
  const numericValue = Number(digits)
  const suggestedValues = !isNegative && digits && numericValue > 0 && numericValue < 1000
    ? [`${digits}000`, `${digits}000000`]
    : []

  return (
    <span className="mo-amount-control">
      <input
        type="text"
        inputMode={allowNegative ? 'decimal' : 'numeric'}
        pattern={allowNegative ? '-?[0-9.]*' : '[0-9.]*'}
        autoComplete="off"
        maxLength={22}
        required={required}
        value={`${isNegative ? '-' : ''}${formatIntegerInput(value)}`}
        onChange={(event) => {
          const nextValue = event.target.value
          const negative = allowNegative && nextValue.trimStart().startsWith('-')
          const nextDigits = nextValue.replace(/\D/g, '').slice(0, 16)
          onChange(`${negative ? '-' : ''}${nextDigits}`)
        }}
        placeholder={placeholder}
      />
      <small className="mo-amount-unit">MO</small>
      {suggestedValues.map((suggestedValue) => (
        <button
          key={suggestedValue}
          className="mo-amount-suggestion"
          type="button"
          aria-label={`Dùng đề xuất ${formatIntegerInput(suggestedValue)} MO`}
          onClick={() => onChange(suggestedValue)}
        >
          {formatIntegerInput(suggestedValue)} MO · +{suggestedValue.endsWith('000000') ? '000000' : '000'}
        </button>
      ))}
    </span>
  )
}

function MiniJar({ source, balance }: { source: MoneySource; balance: number }) {
  return (
    <div className="mini-jar">
      <span className="mini-jar-glass" aria-hidden="true"><MochiMascot /></span>
      <strong>{sourceLabel(source)}</strong>
      <small>{source.balanceMode === 'debt' || balance < 0 ? 'Nợ' : 'Số dư'} · {formatMoney(Math.abs(balance))}</small>
    </div>
  )
}

export default App
