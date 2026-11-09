import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  db,
  type Budget,
  type Goal,
  type GoalContribution,
  type MoneySource,
  type MoneySourceBalanceMode,
  type MoneySourceFinancialKind,
  type MochiPointHistoryEntry,
  type MochiPointsRecord,
  type Task,
  type Transaction,
  type TransactionType,
} from './db'
import AssistantWidget from './AssistantWidget'
import type { ChiChatSnapshot } from './AssistantWidget'
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
import { backupPreferenceKeys, parseMochiBackup } from './backup'
import Charts from './components/Charts'
import DashboardIcon from './components/DashboardIcon'
import EmptyState from './components/EmptyState'
import LocalAuthScreen from './components/LocalAuthScreen'
import MOAmountInput from './components/MOAmountInput'
import MochiWordmark from './components/MochiWordmark'
import MoneySourceIcon from './components/MoneySourceIcon'
import SectionHeading from './components/SectionHeading'
import SummaryCard from './components/SummaryCard'
import Wardrobe, {
  accessorySlots,
  mochiColors,
  type AccessoryOption,
  type AccessorySlot,
  type MochiOutfit,
} from './components/Wardrobe'
import { useMochiData } from './hooks/useMochiData'
import {
  calculateFinancialTotals,
  getSourceBalance,
  getSourceDisplayBalance,
  isAssetSource,
  isSourceDebt as getIsSourceDebt,
} from './utils/finance'
import { adjustMochiPoints } from './utils/points'
import './App.css'

type Page = 'home' | 'charts' | 'wardrobe' | 'budgets' | 'goals' | 'tasks' | 'transactions' | 'sources' | 'settings'
type DashboardIconName = Page | 'assistant'

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
  'Tài khoản',
  'Thẻ ghi nợ',
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
const FREQUENT_CATEGORY_OPTIONS_KEY = 'mochi-frequent-category-options'
const initialFrequentCategories = ['Ăn uống', 'Di chuyển', 'Hóa đơn', 'Mua sắm', 'Sức khỏe']

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

const moneySourceFinancialKindLabels: Record<MoneySourceFinancialKind, string> = {
  income: 'Thu',
  expense: 'Chi',
  debt: 'Nợ',
  lent: 'Cho mượn',
}

const isDebitCardSource = (sourceType: string) =>
  sourceType.trim().toLocaleLowerCase('vi-VN') === 'thẻ ghi nợ'

const sourceLabel = (source: MoneySource) => {
  const note = source.name.trim()
  return note ? `${source.type} · ${note}` : source.type
}

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
  const [isImportingBackup, setIsImportingBackup] = useState(false)
  const backupFileInput = useRef<HTMLInputElement>(null)
  const [page, setPage] = useState<Page>('home')
  const [isDashboardOpen, setIsDashboardOpen] = useState(true)
  const [backgroundColor, setBackgroundColor] = useState(getInitialBackgroundColor)
  const [savedMochiOutfit, setSavedMochiOutfit] = useState<MochiOutfit>(readMochiOutfit)
  const [mochiOutfit, setMochiOutfit] = useState<MochiOutfit>(savedMochiOutfit)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [onboardingPending, setOnboardingPending] = useState(false)
  const [categorySetupPending, setCategorySetupPending] = useState(false)
  const [isCategorySetupOpen, setIsCategorySetupOpen] = useState(false)
  const [categorySetupOptions, setCategorySetupOptions] = useState(defaultCategoryOptions)
  const [categorySetupSelection, setCategorySetupSelection] = useState(initialFrequentCategories)
  const [newSetupCategory, setNewSetupCategory] = useState('')
  const [onboardingEnabled, setOnboardingEnabled] = useState(false)
  const [onboardingCompletedPages, setOnboardingCompletedPages] = useState<Page[]>([])
  const [activeTourPage, setActiveTourPage] = useState<Page | 'welcome' | null>(null)
  const [isSplashVisible, setIsSplashVisible] = useState(true)
  const [activeBudgetIndex, setActiveBudgetIndex] = useState(0)
  const [isBudgetPickerOpen, setIsBudgetPickerOpen] = useState(false)
  const [isBudgetPickerClosing, setIsBudgetPickerClosing] = useState(false)
  const budgetPickerCloseTimer = useRef<number | null>(null)
  const [jarMotionDirection, setJarMotionDirection] = useState<'left' | 'right' | null>('right')
  const [pendingJar, setPendingJar] = useState<{ index: number; direction: 'left' | 'right' } | null>(null)
  const [openJarKey, setOpenJarKey] = useState<string | null>(null)
  const [draggedSourceId, setDraggedSourceId] = useState<number | null>(null)
  const [budgetExpenseSourceId, setBudgetExpenseSourceId] = useState<number | null>(null)
  const [budgetExpenseTarget, setBudgetExpenseTarget] = useState<Budget | null>(null)
  const [budgetExpenseAmount, setBudgetExpenseAmount] = useState('')
  const [mochiDropId, setMochiDropId] = useState(0)
  const [floatingTransactions, setFloatingTransactions] = useState<Transaction[]>([])
  const budgetDropHandled = useRef(false)
  const touchSourceDrag = useRef<{ sourceId: number; pointerId: number; startX: number; startY: number; moved: boolean } | null>(null)
  const suppressSourceClick = useRef(false)
  const knownTransactionIds = useRef<Set<number> | null>(null)
  const transactionBubbleTimers = useRef(new Map<number, number>())
  const [error, setError] = useState('')
  const [isPointsGuideOpen, setIsPointsGuideOpen] = useState(false)
  const [mochiPoints, setMochiPoints] = useState(0)
  const [pointHistory, setPointHistory] = useState<MochiPointHistoryEntry[]>([])
  const [unlockedAccessories, setUnlockedAccessories] = useState<string[]>([])
  const [pointsPulse, setPointsPulse] = useState(0)
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
  const [sourceFinancialKind, setSourceFinancialKind] = useState<MoneySourceFinancialKind | ''>('')
  const [sourceCreditLimit, setSourceCreditLimit] = useState('')
  const [sourceIncludeInTotal, setSourceIncludeInTotal] = useState(true)
  const [moneySourceTypes, setMoneySourceTypes] = useState<string[]>(defaultMoneySourceTypes)
  const [newMoneySourceType, setNewMoneySourceType] = useState('')
  const [editingMoneySourceType, setEditingMoneySourceType] = useState<string | null>(null)
  const [moneySourceTypeDraft, setMoneySourceTypeDraft] = useState('')
  const [categoryOptions, setCategoryOptions] = useState<string[]>(defaultCategoryOptions)
  const [frequentCategories, setFrequentCategories] = useState<string[]>([])
  const [newCategoryOption, setNewCategoryOption] = useState('')
  const [editingCategoryOption, setEditingCategoryOption] = useState<string | null>(null)
  const [categoryOptionDraft, setCategoryOptionDraft] = useState('')
  const [sourceInitialBalance, setSourceInitialBalance] = useState('0')
  const [sourceBalanceMode, setSourceBalanceMode] = useState<MoneySourceBalanceMode>('asset')
  const [sourceOpeningDate, setSourceOpeningDate] = useState(today())
  const [editingSourceId, setEditingSourceId] = useState<number | null>(null)
  const [checkInDates, setCheckInDates] = useState<string[]>([])
  const [localToday, setLocalToday] = useState(getLocalDateKey)

  const [budgetCategory, setBudgetCategory] = useState('')
  const [budgetLimit, setBudgetLimit] = useState('')
  const [budgetMonth, setBudgetMonth] = useState(currentMonth())
  const [editingBudgetId, setEditingBudgetId] = useState<number | null>(null)
  const [isHomeCategoryFormOpen, setIsHomeCategoryFormOpen] = useState(false)
  const [homeCategoryName, setHomeCategoryName] = useState('')
  const [homeCategoryNote, setHomeCategoryNote] = useState('')
  const [homeCategoryBudgetLimit, setHomeCategoryBudgetLimit] = useState('')

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

  const handleDataLoaded = useCallback(async (allTransactions: Transaction[], savedPoints: MochiPointsRecord | undefined) => {
    const savedUnlocks = savedPoints?.unlockedAccessories ?? []
    const persistedOutfit = readMochiOutfit()
    const equippedLegacyAccessories = accessorySlots
      .map(({ id }) => persistedOutfit[id] === 'none' ? null : `${id}:${persistedOutfit[id]}`)
      .filter((accessory): accessory is string => accessory !== null)
    const mergedUnlocks = [...new Set([...savedUnlocks, ...equippedLegacyAccessories])]
    setMoneySourceTypes(readOptionList(MONEY_SOURCE_TYPES_KEY, defaultMoneySourceTypes))
    setCategoryOptions(readOptionList(
      CATEGORY_OPTIONS_KEY,
      defaultCategoryOptions,
      allTransactions.filter((transaction) => !transaction.isOpeningBalance).map((transaction) => transaction.category),
    ))
    setFrequentCategories(readOptionList(FREQUENT_CATEGORY_OPTIONS_KEY, []))
    setMochiPoints(savedPoints?.total ?? 0)
    setPointHistory(savedPoints?.pointHistory ?? [])
    setCheckInDates(savedPoints?.checkInDates ?? [])
    setCategorySetupPending(savedPoints?.categorySetupCompleted === false)
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
  }, [])
  const {
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
  } = useMochiData(username, storedAuth.username !== null, handleDataLoaded, setError)

  useEffect(() => {
    knownTransactionIds.current = null
    transactionBubbleTimers.current.forEach((timer) => window.clearTimeout(timer))
    transactionBubbleTimers.current.clear()
    setFloatingTransactions([])
  }, [username])

  useEffect(() => {
    if (!username || isDataLoading) return
    const savedIds = new Set(transactions.flatMap((transaction) =>
      transaction.id === undefined ? [] : [transaction.id],
    ))
    if (knownTransactionIds.current === null) {
      knownTransactionIds.current = savedIds
      return
    }

    const addedTransactions = transactions.filter((transaction) =>
      transaction.id !== undefined &&
      !knownTransactionIds.current?.has(transaction.id) &&
      !transaction.isOpeningBalance,
    )
    knownTransactionIds.current = savedIds
    if (addedTransactions.length === 0) return

    setFloatingTransactions((current) => {
      const currentIds = new Set(current.map((transaction) => transaction.id))
      return [...current, ...addedTransactions.filter((transaction) => !currentIds.has(transaction.id))]
    })
    addedTransactions.forEach((transaction) => {
      if (transaction.id === undefined) return
      const existingTimer = transactionBubbleTimers.current.get(transaction.id)
      if (existingTimer !== undefined) window.clearTimeout(existingTimer)
      const timer = window.setTimeout(() => {
        setFloatingTransactions((current) => current.filter((item) => item.id !== transaction.id))
        transactionBubbleTimers.current.delete(transaction.id!)
      }, 10_000)
      transactionBubbleTimers.current.set(transaction.id, timer)
    })
  }, [isDataLoading, transactions, username])

  useEffect(() => () => {
    transactionBubbleTimers.current.forEach((timer) => window.clearTimeout(timer))
    transactionBubbleTimers.current.clear()
  }, [])

  useEffect(() => {
    const splashTimer = window.setTimeout(() => setIsSplashVisible(false), 2200)
    return () => window.clearTimeout(splashTimer)
  }, [])

  useEffect(() => {
    if (page !== 'transactions' || editingTransactionId === null) return
    const frame = window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('[data-tour-target="transactions-form"]')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [editingTransactionId, page])

  useEffect(() => {
    const timer = window.setInterval(() => setLocalToday(getLocalDateKey()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!categorySetupPending || isDataLoading || isSplashVisible) return
    const timer = window.setTimeout(() => {
      setIsCategorySetupOpen(true)
      setCategorySetupPending(false)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [categorySetupPending, isDataLoading, isSplashVisible])

  useEffect(() => {
    if (!onboardingPending || isDataLoading || isSplashVisible) return
    const timer = window.setTimeout(() => {
      setActiveTourPage('welcome')
      setOnboardingPending(false)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [isDataLoading, isSplashVisible, onboardingPending])

  useEffect(() => {
    if (activeTourPage === 'home') setIsDashboardOpen(true)
  }, [activeTourPage])

  useEffect(() => {
    if (
      !onboardingEnabled ||
      onboardingPending ||
      categorySetupPending ||
      isCategorySetupOpen ||
      isDataLoading ||
      isSplashVisible ||
      onboardingCompletedPages.includes(page)
    ) return
    if (page !== 'home' && !onboardingCompletedPages.includes('home')) return

    const timer = window.setTimeout(() => setActiveTourPage(page), 0)
    return () => window.clearTimeout(timer)
  }, [categorySetupPending, isCategorySetupOpen, isDataLoading, isSplashVisible, onboardingCompletedPages, onboardingEnabled, onboardingPending, page])

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
          categorySetupCompleted: false,
          onboardingEnabled: true,
          onboardingCompletedPages: [],
        })
        setIsDataLoading(true)
        setUsername(normalizedName)
        setCategorySetupPending(true)
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
    setCategorySetupPending(false)
    setIsCategorySetupOpen(false)
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
          FREQUENT_CATEGORY_OPTIONS_KEY,
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

  const runAction = async (action: () => Promise<void>) => {
    setError('')
    try {
      await action()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Đã xảy ra lỗi. Vui lòng thử lại.')
    }
  }

  const exportAccountBackup = () => {
    void runAction(async () => {
      const [allTransactions, allBudgets, allGoals, allGoalContributions, allTasks, allMoneySources, allPoints] =
        await db.transaction('r', db.tables, () => Promise.all([
          db.transactions.toArray(),
          db.budgets.toArray(),
          db.goals.toArray(),
          db.goalContributions.toArray(),
          db.tasks.toArray(),
          db.moneySources.toArray(),
          db.points.toArray(),
        ]))
      const preferences = Object.fromEntries(
        backupPreferenceKeys.map((key) => [key, localStorage.getItem(getAccountPreferenceKey(key))]),
      )
      const backup = {
        format: 'mochi-backup',
        version: 1,
        exportedAt: new Date().toISOString(),
        tables: {
          transactions: allTransactions,
          budgets: allBudgets,
          goals: allGoals,
          goalContributions: allGoalContributions,
          tasks: allTasks,
          moneySources: allMoneySources,
          points: allPoints,
        },
        preferences,
      }
      const file = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const downloadUrl = URL.createObjectURL(file)
      const downloadLink = document.createElement('a')
      downloadLink.href = downloadUrl
      downloadLink.download = `mochi-backup-${today()}.json`
      downloadLink.click()
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
    })
  }

  const importAccountBackup = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return

    setIsImportingBackup(true)
    void runAction(async () => {
      if (file.size > 25 * 1024 * 1024) {
        throw new Error('Tệp sao lưu quá lớn. Hãy chọn tệp nhỏ hơn 25 MB.')
      }

      let parsedFile: unknown
      try {
        parsedFile = JSON.parse(await file.text())
      } catch {
        throw new Error('Không đọc được tệp JSON. Hãy chọn một tệp sao lưu Mochi hợp lệ.')
      }
      const backup = parseMochiBackup(parsedFile)
      if (!window.confirm('Nhập bản sao lưu sẽ thay thế toàn bộ dữ liệu Mochi của tài khoản hiện tại. Tài khoản và mật khẩu sẽ không bị thay đổi. Bạn có chắc chắn muốn tiếp tục?')) {
        return
      }

      const oldPreferences = backupPreferenceKeys.map((key) => ({
        key: getAccountPreferenceKey(key),
        value: localStorage.getItem(getAccountPreferenceKey(key)),
      }))
      try {
        backupPreferenceKeys.forEach((key) => {
          const value = backup.preferences[key]
          const storageKey = getAccountPreferenceKey(key)
          if (value === null) localStorage.removeItem(storageKey)
          else localStorage.setItem(storageKey, value)
        })

        const accountDataTables = db.tables
        await db.transaction('rw', accountDataTables, async () => {
          await Promise.all(accountDataTables.map((table) => table.clear()))
          await Promise.all([
            db.transactions.bulkPut(backup.tables.transactions),
            db.budgets.bulkPut(backup.tables.budgets),
            db.goals.bulkPut(backup.tables.goals),
            db.goalContributions.bulkPut(backup.tables.goalContributions),
            db.tasks.bulkPut(backup.tables.tasks),
            db.moneySources.bulkPut(backup.tables.moneySources),
            db.points.bulkPut(backup.tables.points),
          ])
        })
      } catch (importError) {
        const preferenceRestoreErrors: unknown[] = []
        oldPreferences.forEach(({ key, value }) => {
          try {
            if (value === null) localStorage.removeItem(key)
            else localStorage.setItem(key, value)
          } catch (restoreError) {
            preferenceRestoreErrors.push(restoreError)
          }
        })
        if (preferenceRestoreErrors.length > 0) {
          throw new Error(
            `Nhập bản sao lưu thất bại và không thể khôi phục ${preferenceRestoreErrors.length} tùy chỉnh cũ. Dữ liệu bảng Dexie đã được giữ nguyên; hãy kiểm tra lại tùy chỉnh trước khi thử lại.`,
          )
        }
        throw importError
      }

      window.location.reload()
    }).finally(() => setIsImportingBackup(false))
  }

  const completeOnboardingPage = (completedPage: Page) => {
    setActiveTourPage(null)
    if (completedPage === 'home') setIsDashboardOpen(false)
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
      let updatedPoints: MochiPointsRecord | undefined
      await db.transaction('rw', db.points, async () => {
        const pointsRecord = await db.points.get(1)
        savedDates = pointsRecord?.checkInDates ?? []
        if (savedDates.includes(localToday)) return
        savedDates = [...savedDates, localToday].slice(-400)
        updatedPoints = adjustMochiPoints(pointsRecord, 1, 'Điểm danh hằng ngày +1 sao')
        await db.points.put({
          ...pointsRecord,
          ...updatedPoints,
          id: 1,
          checkInDates: savedDates,
        })
      })
      setCheckInDates(savedDates)
      if (updatedPoints) {
        setMochiPoints(updatedPoints.total)
        setPointHistory(updatedPoints.pointHistory ?? [])
        setPointsPulse((pulse) => pulse + 1)
      }
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
      let updatedPoints: MochiPointsRecord | undefined
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

        updatedPoints = adjustMochiPoints(pointsRecord, -option.cost!, `Đổi phụ kiện: ${option.label}`)
        pointsAfterPurchase = updatedPoints.total
        ownedAccessories = [...ownedAccessories, accessoryKey]
        await db.points.put({
          ...pointsRecord,
          ...updatedPoints,
          id: 1,
          unlockedAccessories: ownedAccessories,
        })
      })

      setMochiPoints(pointsAfterPurchase)
      if (updatedPoints) setPointHistory(updatedPoints.pointHistory ?? [])
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
      const source = moneySources.find((item) => item.id === budgetExpenseSourceId)
      if (!source || source.id === undefined) {
        throw new Error('Hãy chọn một nguồn MO trước khi ghi khoản chi này.')
      }
      await db.transactions.add({
        type: 'expense',
        amount: value,
        category: budgetExpenseTarget.category,
        note: `Chi cho ${budgetExpenseTarget.category}`,
        date: today(),
        sourceId: source.id,
      })
      await refreshTransactions()
      setBudgetExpenseTarget(null)
      setBudgetExpenseAmount('')
      setBudgetExpenseSourceId(null)
      setMochiDropId((id) => id + 1)
      const jarKey = activeJarKey
      setOpenJarKey(jarKey)
      window.setTimeout(() => setOpenJarKey((openKey) => openKey === jarKey ? null : openKey), 900)
    })
  }

  const scrollToForm = (selector: string) => {
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(selector)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
    scrollToForm('[data-tour-target="transactions-form"]')
  }

  const openFloatingTransaction = (transaction: Transaction) => {
    if (transaction.id !== undefined) {
      const timer = transactionBubbleTimers.current.get(transaction.id)
      if (timer !== undefined) window.clearTimeout(timer)
      transactionBubbleTimers.current.delete(transaction.id)
      setFloatingTransactions((current) => current.filter((item) => item.id !== transaction.id))
    }
    setPage('transactions')
    editTransaction(transaction)
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
      if (!sourceFinancialKind) {
        throw new Error('Hãy chọn nhóm nguồn: Thu, Chi, Nợ hoặc Cho mượn.')
      }
      if (!sourceType.trim()) {
        throw new Error('Hãy chọn loại nguồn MO.')
      }
      const isDebitCard = isDebitCardSource(sourceType)
      const creditLimit = isDebitCard ? Number(sourceCreditLimit) : undefined
      if (isDebitCard && (
        sourceCreditLimit.trim() === '' ||
        creditLimit === undefined ||
        !Number.isSafeInteger(creditLimit) ||
        creditLimit < 0
      )) {
        throw new Error('Hạn mức ban đầu của thẻ cần là số MO nguyên không âm.')
      }
      const source = {
        name: sourceName.trim(),
        type: sourceType.trim(),
        financialKind: sourceFinancialKind,
        initialBalance: Number(sourceInitialBalance),
        balanceMode: sourceBalanceMode,
        ...(isDebitCard ? { creditLimit, includeInTotal: sourceIncludeInTotal } : {}),
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
      setSourceFinancialKind('')
      setSourceInitialBalance('0')
      setSourceCreditLimit('')
      setSourceIncludeInTotal(true)
      setSourceBalanceMode('asset')
      setSourceOpeningDate(today())
    })
  }

  const editMoneySource = (source: MoneySource) => {
    setEditingSourceId(source.id ?? null)
    setSourceName(source.name)
    setSourceType(source.type)
    setSourceFinancialKind(source.financialKind ?? '')
    setSourceInitialBalance(String(source.initialBalance))
    setSourceCreditLimit(source.creditLimit === undefined ? '' : String(source.creditLimit))
    setSourceIncludeInTotal(source.includeInTotal !== false)
    setSourceBalanceMode(source.balanceMode ?? 'asset')
    setSourceOpeningDate(
      transactions.find((transaction) => transaction.id === source.openingBalanceTransactionId)?.date ?? today(),
    )
    scrollToForm('[data-tour-target="sources-form"]')
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

  const toggleSetupCategory = (option: string) => {
    setCategorySetupSelection((selected) =>
      selected.includes(option)
        ? selected.filter((item) => item !== option)
        : [...selected, option],
    )
  }

  const addSetupCategory = () => {
    const newOption = newSetupCategory.trim()
    if (!newOption) return
    if (categorySetupOptions.some((option) =>
      option.toLocaleLowerCase('vi-VN') === newOption.toLocaleLowerCase('vi-VN'),
    )) {
      setError('Danh mục này đã có trong danh sách.')
      return
    }
    setCategorySetupOptions((options) => [...options, newOption])
    setCategorySetupSelection((selected) => [...selected, newOption])
    setNewSetupCategory('')
    setError('')
  }

  const finishCategorySetup = (saveSelection: boolean) => {
    if (!username) return
    const selected = saveSelection ? [...new Set(categorySetupSelection)] : []
    const knownCategories = saveSelection
      ? [...new Set([...categoryOptions, ...categorySetupOptions])]
      : categoryOptions
    void runAction(async () => {
      localStorage.setItem(getAccountPreferenceKey(CATEGORY_OPTIONS_KEY), JSON.stringify(knownCategories))
      localStorage.setItem(getAccountPreferenceKey(FREQUENT_CATEGORY_OPTIONS_KEY), JSON.stringify(selected))
      await db.transaction('rw', db.points, db.budgets, async () => {
        const pointsRecord = await db.points.get(1)
        await db.points.put({
          ...pointsRecord,
          id: 1,
          total: pointsRecord?.total ?? 0,
          categorySetupCompleted: true,
        })

        if (saveSelection) {
          const monthKey = currentMonth()
          const existingBudgets = await db.budgets.where('month').equals(monthKey).toArray()
          const existingCategories = new Set(existingBudgets.map((budget) => budget.category.trim().toLocaleLowerCase('vi-VN')))
          const newBudgets = [...new Set(selected.map((category) => category.trim()).filter(Boolean))]
            .filter((category) => !existingCategories.has(category.toLocaleLowerCase('vi-VN')))
            .map((category) => ({
              category,
              limit: 0,
              month: monthKey,
            }))

          if (newBudgets.length > 0) {
            await db.budgets.bulkAdd(newBudgets)
          }
        }
      })
      await refreshBudgets()
      setCategoryOptions(knownCategories)
      setFrequentCategories(selected)
      setError('')
      setIsCategorySetupOpen(false)
      setOnboardingPending(true)
    })
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
      const existingBudget = budgets.find((item) => item.id === editingBudgetId)
      const budget: Budget = {
        category: budgetCategory.trim(),
        limit,
        month: budgetMonth,
        ...(existingBudget?.note ? { note: existingBudget.note } : {}),
        ...(existingBudget?.subcategories ? { subcategories: existingBudget.subcategories } : {}),
      }
      if (editingBudgetId === null) {
        await db.budgets.add(budget)
      } else {
        await db.budgets.put({ ...budget, id: editingBudgetId })
      }
      await refreshBudgets()
      setEditingBudgetId(null)
      setBudgetCategory('')
      setBudgetLimit('')
    })
  }

  const saveHomeCategory = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const categoryName = homeCategoryName.trim()
    if (!categoryName) {
      setError('Hãy nhập tên danh mục.')
      return
    }

    const duplicate = budgets.some((budget) =>
      budget.month === currentMonth() &&
      budget.category.trim().toLocaleLowerCase('vi-VN') === categoryName.toLocaleLowerCase('vi-VN'),
    )
    if (duplicate) {
      setError('Danh mục này đã có trong tháng hiện tại.')
      return
    }

    let limit = 0
    if (homeCategoryBudgetLimit.trim()) {
      limit = Number(homeCategoryBudgetLimit)
      if (!Number.isSafeInteger(limit) || limit <= 0) {
        setError('Ngân sách tùy chọn cần là số MO nguyên lớn hơn 0.')
        return
      }
    }

    void runAction(async () => {
      await db.budgets.add({
        category: categoryName,
        ...(homeCategoryNote.trim() ? { note: homeCategoryNote.trim() } : {}),
        limit,
        month: currentMonth(),
      })
      await refreshBudgets()
      const nextOptions = categoryOptions.some((option) =>
        option.toLocaleLowerCase('vi-VN') === categoryName.toLocaleLowerCase('vi-VN'),
      ) ? categoryOptions : [...categoryOptions, categoryName]
      persistCategoryOptions(nextOptions)
      setActiveBudgetIndex(homeBudgets.length)
      setHomeCategoryName('')
      setHomeCategoryNote('')
      setHomeCategoryBudgetLimit('')
      setIsHomeCategoryFormOpen(false)
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
      let updatedPoints: MochiPointsRecord | undefined
      await db.transaction('rw', db.goals, db.points, db.tasks, async () => {
        const existingGoal = editingGoalId === null ? undefined : await db.goals.get(editingGoalId)
        const nextGoal = {
          name: goalName.trim(),
          targetAmount,
          savedAmount: existingGoal?.savedAmount ?? savedAmount,
          deadline: goalDeadline,
          ...(existingGoal?.taskRewarded ? { taskRewarded: true } : {}),
        }
        const goalId = editingGoalId === null
          ? await db.goals.add(nextGoal)
          : editingGoalId
        if (editingGoalId !== null) await db.goals.put({ ...nextGoal, id: goalId })

        if (nextGoal.savedAmount >= targetAmount) {
          const completedAt = new Date().toISOString()
          const linkedTasks = (await db.tasks.toArray()).filter((task) =>
            task.goalId === goalId && !task.completed && task.id !== undefined,
          )
          for (const task of linkedTasks) {
            await db.tasks.update(task.id!, { completed: true, completedAt })
          }
          if (!existingGoal?.taskRewarded) {
            await db.goals.update(goalId, { taskRewarded: true })
            const pointsRecord = await db.points.get(1)
            updatedPoints = adjustMochiPoints(pointsRecord, 1, `Hoàn thành mục tiêu: ${nextGoal.name} (+1 sao)`)
            await db.points.put({ ...pointsRecord, ...updatedPoints })
          }
        }
      })
      if (updatedPoints) {
        setMochiPoints(updatedPoints.total)
        setPointHistory(updatedPoints.pointHistory ?? [])
        setPointsPulse((pulse) => pulse + 1)
      }
      await Promise.all([refreshGoals(), refreshTasks()])
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
    scrollToForm('[data-tour-target="goals-form"]')
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

      let updatedPoints: MochiPointsRecord | undefined
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
          }
          if (!goal.taskRewarded) {
            await db.goals.update(goalId, { taskRewarded: true })
            const pointsRecord = await db.points.get(1)
            updatedPoints = adjustMochiPoints(pointsRecord, 1, `Hoàn thành mục tiêu: ${goal.name} (+1 sao)`)
            await db.points.put({
              ...pointsRecord,
              ...updatedPoints,
            })
          }
        }
      })
      if (updatedPoints) {
        setMochiPoints(updatedPoints.total)
        setPointHistory(updatedPoints.pointHistory ?? [])
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
    scrollToForm('.saving-form')
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

  const deleteTask = (task: Task) => {
    if (task.id === undefined) return
    void runAction(async () => {
      await db.tasks.delete(task.id!)
      await refreshTasks()
    })
  }

  const { totalIncome, totalExpense, netWorth } = calculateFinancialTotals(transactions, moneySources)
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
  const sourceBalance = (source: MoneySource) => getSourceBalance(source, transactions)
  const isSourceDebt = (source: MoneySource) => getIsSourceDebt(source, transactions)
  const sourceDisplayBalance = (source: MoneySource) => getSourceDisplayBalance(source, transactions)
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
        // Keep legacy subcategory expenses included in their parent budget.
        [budget.category, ...(budget.subcategories ?? [])].includes(transaction.category) &&
        transaction.date.startsWith(budget.month),
      )
      .reduce((sum, transaction) => sum + transaction.amount, 0)
  const activeBudgetMonth = localToday.slice(0, 7)
  useEffect(() => {
    if (!username || isDataLoading) return

    const exceededBudgets = budgets.filter((budget) =>
      budget.id !== undefined &&
      budget.month === activeBudgetMonth &&
      budget.limit > 0 &&
      spentForBudget(budget) >= budget.limit * 1.1,
    )
    if (exceededBudgets.length === 0) return

    void runAction(async () => {
      let updatedPoints: MochiPointsRecord | undefined
      await db.transaction('rw', db.points, async () => {
        const pointsRecord = await db.points.get(1)
        const penaltyKeys = new Set(pointsRecord?.budgetPenaltyKeys ?? [])
        let nextPoints = pointsRecord
        let hasNewPenalty = false

        for (const budget of exceededBudgets) {
          if (budget.id === undefined) continue
          const penaltyKey = `${budget.id}:${budget.month}`
          if (penaltyKeys.has(penaltyKey)) continue
          hasNewPenalty = true
          penaltyKeys.add(penaltyKey)
          nextPoints = adjustMochiPoints(
            nextPoints,
            -1,
            nextPoints?.total
              ? `Vượt ngân sách ${budget.category} từ 10% (-1 sao)`
              : `Vượt ngân sách ${budget.category} từ 10% (không còn sao để trừ)`,
          )
        }

        if (!hasNewPenalty || !nextPoints) return
        const pointsToSave: MochiPointsRecord = {
          ...nextPoints,
          id: 1,
          budgetPenaltyKeys: [...penaltyKeys],
        }
        updatedPoints = pointsToSave
        await db.points.put(pointsToSave)
      })

      if (updatedPoints) {
        setMochiPoints(updatedPoints.total)
        setPointHistory(updatedPoints.pointHistory ?? [])
        setPointsPulse((pulse) => pulse + 1)
      }
    })
  }, [activeBudgetMonth, budgets, isDataLoading, transactions, username])

  const remainingForBudget = (budget: Budget) => Math.max(0, budget.limit - spentForBudget(budget))
  const budgetUsagePercent = (budget: Budget) => budget.limit > 0
    ? Math.min((spentForBudget(budget) / budget.limit) * 100, 100)
    : 0
  const budgetMochiCount = (budget: Budget) => Math.min(12, Math.ceil((budgetUsagePercent(budget) / 100) * 12))
  const chiChatSnapshot: ChiChatSnapshot = {
    asOf: localToday,
    transactions: transactions
      .filter((transaction) => !transaction.isOpeningBalance)
      .map((transaction) => ({
        date: transaction.date,
        type: transaction.type,
        amount: transaction.amount,
        category: transaction.category,
      })),
    budgets: budgets
      .filter((budget) => budget.month === currentMonth())
      .map((budget) => ({
        category: budget.category,
        limit: budget.limit,
        spent: spentForBudget(budget),
      })),
    goals: goals.map((goal) => ({
      name: goal.name,
      targetAmount: goal.targetAmount,
      savedAmount: goal.savedAmount,
      deadline: goal.deadline,
      recentDailyContribution: goalContributions
        .filter((contribution) =>
          contribution.goalId === goal.id &&
          contribution.date >= getLocalDateDaysAgo(29) &&
          contribution.date <= localToday,
        )
        .reduce((sum, contribution) => sum + contribution.amount, 0) / 30,
    })),
  }

  const pageDetails = navigation.find((item) => item.id === page)
  const checkedInToday = checkInDates.includes(localToday)
  const taskCompletionDates = tasks
    .filter((task) => task.completed)
    .map((task) => task.completedAt ? getLocalDateKey(new Date(task.completedAt)) : task.date)
  const taskStreak = getCheckInStreak(taskCompletionDates, localToday)
  const sortedPointHistory = [...pointHistory].sort((first, second) =>
    second.createdAt.localeCompare(first.createdAt),
  )
  const recentThreeDayTransactions = transactions.filter((transaction) =>
    !transaction.isOpeningBalance &&
    transaction.date >= getLocalDateDaysAgo(2) &&
    transaction.date <= localToday,
  )
  const threeDayIncome = recentThreeDayTransactions
    .filter((transaction) => ['income', 'borrow', 'collect'].includes(transaction.type))
    .reduce((sum, transaction) => sum + transaction.amount, 0)
  const threeDayExpense = recentThreeDayTransactions
    .filter((transaction) => ['expense', 'repay', 'lend', 'cardPayment'].includes(transaction.type))
    .reduce((sum, transaction) => sum + transaction.amount, 0)
  const todayExpense = transactions
    .filter((transaction) =>
      transaction.date === localToday &&
      !transaction.isOpeningBalance &&
      ['expense', 'repay', 'lend', 'cardPayment'].includes(transaction.type),
    )
    .reduce((sum, transaction) => sum + transaction.amount, 0)
  const availableTransactionSources = transactionType === 'expense'
    ? moneySources
    : moneySources.filter(isAssetSource)
  const homeBudgets = budgets.filter((budget) => budget.month === currentMonth())
  const safeBudgetIndex = homeBudgets.length ? activeBudgetIndex % homeBudgets.length : 0
  const activeBudgetDetail = homeBudgets[safeBudgetIndex] ?? null
  const draggedSource = moneySources.find((source) => source.id === draggedSourceId)
  const selectedBudgetExpenseSource = moneySources.find((source) => source.id === budgetExpenseSourceId)
  const canReceiveDraggedSource = Boolean(draggedSource && activeBudgetDetail) && !pendingJar
  const activeJarKey = `budget:${activeBudgetDetail?.id ?? activeBudgetDetail?.category ?? 'empty'}`
  const isActiveJarOpen = openJarKey === activeJarKey
  const closeBudgetPicker = () => {
    if (!isBudgetPickerOpen || isBudgetPickerClosing) return
    setIsBudgetPickerClosing(true)
    budgetPickerCloseTimer.current = window.setTimeout(() => {
      setIsBudgetPickerOpen(false)
      setIsBudgetPickerClosing(false)
      budgetPickerCloseTimer.current = null
    }, 220)
  }
  const openBudgetPicker = () => {
    if (budgetPickerCloseTimer.current !== null) {
      window.clearTimeout(budgetPickerCloseTimer.current)
      budgetPickerCloseTimer.current = null
    }
    setIsBudgetPickerClosing(false)
    setIsBudgetPickerOpen(true)
  }
  const beginJarTransition = (index: number, direction: 'left' | 'right') => {
    if (pendingJar) return
    if (index === safeBudgetIndex || !homeBudgets.length) return
    closeBudgetPicker()
    setPendingJar({ index, direction })
    setBudgetExpenseTarget(null)
    setBudgetExpenseSourceId(null)
    setBudgetExpenseAmount('')
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
      <LocalAuthScreen
        authMode={authMode}
        authName={authName}
        authPassword={authPassword}
        allowPasswordManager={allowPasswordManager}
        authBusy={authBusy}
        authError={authError}
        onAuthModeChange={(mode) => { setAuthMode(mode); setAuthError('') }}
        onAuthNameChange={setAuthName}
        onAuthPasswordChange={setAuthPassword}
        onAllowPasswordManagerChange={setAllowPasswordManager}
        onSubmit={submitAuth}
      />
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

      <div className={`mochi-app mochi-workspace${isDashboardOpen ? '' : ' dashboard-collapsed'}${page === 'home' ? ' home-view' : ''}${activeTourPage === 'home' ? ' home-tour-active' : ''}${isBudgetPickerOpen ? ' budget-picker-visible' : ''}${isBudgetPickerClosing ? ' budget-picker-closing' : ''}`} style={{ backgroundColor }}>
        {isBudgetPickerOpen && (
          <button
            className="budget-picker-screen-backdrop"
            type="button"
            aria-label="Đóng danh sách danh mục ngân sách"
            onClick={closeBudgetPicker}
          />
        )}
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
              <span><DashboardIcon name="assistant" /></span> ChiChat
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

        <main className={`workspace-main${page === 'home' ? ' workspace-main-home' : ''}${isBudgetPickerOpen ? ' budget-picker-main' : ''}`}>
          {page === 'home' ? (
            <div className="home-dashboard">
              <section className="home-streak" aria-label="Chuỗi ngày hoàn thành nhiệm vụ">
                <span className="streak-mascot" aria-hidden="true">🍡</span>
                <div>
                  <strong>{taskStreak} ngày liên tiếp</strong>
                  <span>Hãy hoàn thành một nhiệm vụ nhỏ hôm nay</span>
                </div>
                <div className="streak-dots" aria-hidden="true">
                  {Array.from({ length: 7 }, (_, index) => <span className={index >= 7 - Math.min(taskStreak, 7) ? 'complete' : ''} key={index} />)}
                </div>
                <button className="check-in-button" type="button" onClick={checkInToday} disabled={checkedInToday}>
                  {checkedInToday ? 'Đã điểm danh' : 'Điểm danh'}
                </button>
              </section>

              <section className="home-financial-highlights" aria-label="Tổng quan tài chính" data-tour-target="home-summary">
                <article className="home-financial-total">
                  <span>Tổng cộng</span>
                  <strong>{formatMoney(netWorth)}</strong>
                </article>
                <article className="home-today-expense">
                  <span>Tổng chi hôm nay</span>
                  <strong>{formatMoney(todayExpense)}</strong>
                </article>
              </section>

              <section className="home-money-section">
                <header className="home-section-heading">
                  <button className="home-add-source" type="button" onClick={() => setPage('sources')}>
                    + Thêm nguồn MO
                  </button>
                </header>

                <div className="budget-source-picker" data-tour-target="home-budget-bubbles">
                  {moneySources.length ? (
                    <div className="budget-bubble-row" role="group" aria-label="Nguồn MO có thể dùng">
                      {moneySources.map((source) => {
                        const sourceId = source.id
                        if (sourceId === undefined) return null
                        const balance = sourceDisplayBalance(source)
                        return (
                          <button
                            key={sourceId}
                            type="button"
                            draggable={!pendingJar}
                            disabled={Boolean(pendingJar)}
                            aria-label={`${sourceLabel(source)} · ${isSourceDebt(source) ? 'Nợ' : 'Số dư'} ${formatMoney(balance)}`}
                            aria-pressed={budgetExpenseSourceId === sourceId}
                            className={`budget-bubble source-draggable${budgetExpenseSourceId === sourceId ? ' active' : ''}`}
                            onPointerDown={(event) => {
                              if (event.pointerType !== 'touch') return
                              event.currentTarget.setPointerCapture(event.pointerId)
                              touchSourceDrag.current = {
                                sourceId,
                                pointerId: event.pointerId,
                                startX: event.clientX,
                                startY: event.clientY,
                                moved: false,
                              }
                              budgetDropHandled.current = false
                              setDraggedSourceId(sourceId)
                            }}
                            onPointerMove={(event) => {
                              const touchDrag = touchSourceDrag.current
                              if (!touchDrag || touchDrag.pointerId !== event.pointerId) return
                              if (Math.hypot(event.clientX - touchDrag.startX, event.clientY - touchDrag.startY) > 12) {
                                touchDrag.moved = true
                                event.preventDefault()
                              }
                            }}
                            onPointerUp={(event) => {
                              const touchDrag = touchSourceDrag.current
                              if (!touchDrag || touchDrag.pointerId !== event.pointerId) return
                              touchSourceDrag.current = null
                              suppressSourceClick.current = touchDrag.moved
                              if (touchDrag.moved) {
                                const targetJar = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-budget-drop-target]')
                                if (targetJar && activeBudgetDetail && !pendingJar) {
                                  budgetDropHandled.current = true
                                  setBudgetExpenseSourceId(sourceId)
                                  setBudgetExpenseTarget(activeBudgetDetail)
                                  setBudgetExpenseAmount('')
                                  setOpenJarKey(activeJarKey)
                                }
                              } else {
                                setBudgetExpenseSourceId(sourceId)
                              }
                              window.setTimeout(() => { suppressSourceClick.current = false }, 0)
                              setDraggedSourceId(null)
                            }}
                            onPointerCancel={(event) => {
                              if (touchSourceDrag.current?.pointerId !== event.pointerId) return
                              touchSourceDrag.current = null
                              setDraggedSourceId(null)
                              setOpenJarKey(null)
                            }}
                            onDragStart={(event) => {
                              budgetDropHandled.current = false
                              setDraggedSourceId(sourceId)
                              event.dataTransfer.setData('text/plain', String(sourceId))
                              event.dataTransfer.effectAllowed = 'move'
                            }}
                            onDragEnd={() => {
                              setDraggedSourceId(null)
                              if (!budgetDropHandled.current) setOpenJarKey(null)
                              budgetDropHandled.current = false
                            }}
                            onClick={() => {
                              if (suppressSourceClick.current) {
                                suppressSourceClick.current = false
                                return
                              }
                              setBudgetExpenseSourceId(sourceId)
                            }}
                          >
                            <MoneySourceIcon sourceType={source.type} />
                            <span className="budget-bubble-label">{sourceLabel(source)}</span>
                            <span className="source-bubble-balance">
                              {isSourceDebt(source) ? 'Nợ · ' : ''}{formatMoney(balance)}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="home-empty-note">Thêm nguồn MO để bắt đầu ghi chi tiêu.</p>
                  )}
                </div>

                <div className={`home-jar-stage${isBudgetPickerOpen ? ' budget-picker-open' : ''}${isBudgetPickerClosing ? ' budget-picker-closing' : ''}`}>
                  {isBudgetPickerOpen && (
                    <>
                      <button
                        className="budget-picker-backdrop"
                        type="button"
                        aria-label="Đóng danh sách danh mục ngân sách"
                        onClick={closeBudgetPicker}
                      />
                      <div className="budget-category-picker" role="group" aria-label="Chọn danh mục ngân sách">
                        {homeBudgets.map((budget, index) => {
                          const optionCount = homeBudgets.length + 1
                          const angle = -Math.PI / 2 + (2 * Math.PI * index) / optionCount
                          const radius = 144
                          return (
                            <button
                              className={`budget-category-option${index === safeBudgetIndex ? ' active' : ''}`}
                              key={budget.id ?? `${budget.category}-${budget.month}`}
                              type="button"
                              aria-pressed={index === safeBudgetIndex}
                              style={{
                                left: `calc(50% + ${Math.cos(angle) * radius}px)`,
                                top: `calc(50% + ${Math.sin(angle) * radius}px)`,
                                animationDelay: `${index * 45}ms, ${420 + index * 45}ms`,
                              }}
                              onClick={() => index === safeBudgetIndex
                                ? closeBudgetPicker()
                                : beginJarTransition(index, index < safeBudgetIndex ? 'left' : 'right')}
                            >
                              {budget.category}
                            </button>
                          )
                        })}
                        <button
                          className="budget-category-option budget-category-add-option"
                          type="button"
                          aria-label="Thêm danh mục"
                          style={{
                            left: `calc(50% + ${Math.cos(-Math.PI / 2 + (2 * Math.PI * homeBudgets.length) / (homeBudgets.length + 1)) * 144}px)`,
                            top: `calc(50% + ${Math.sin(-Math.PI / 2 + (2 * Math.PI * homeBudgets.length) / (homeBudgets.length + 1)) * 144}px)`,
                            animationDelay: `${homeBudgets.length * 45}ms, ${420 + homeBudgets.length * 45}ms`,
                          }}
                          onClick={() => {
                            closeBudgetPicker()
                            setIsHomeCategoryFormOpen(true)
                          }}
                        >+</button>
                      </div>
                    </>
                  )}
                  <div
                    key={activeBudgetDetail?.id ?? activeBudgetDetail?.category ?? 'budget-jar'}
                    className={`featured-jar budget-featured-jar${pendingJar ? ` exit-${pendingJar.direction === 'right' ? 'left' : 'right'}` : jarMotionDirection ? ` ${jarMotionDirection}` : ''}${isActiveJarOpen || canReceiveDraggedSource ? ' open' : ''}${canReceiveDraggedSource ? ' drop-ready' : ''}`}
                    style={{ zIndex: isBudgetPickerOpen ? 1 : undefined }}
                    data-tour-target="home-mochi-jar"
                    data-budget-drop-target="true"
                    onAnimationEnd={(event) => {
                      if (!pendingJar || !event.animationName.startsWith('budget-jar-exit-')) return
                      setJarMotionDirection(null)
                      setActiveBudgetIndex(pendingJar.index)
                      setJarMotionDirection(pendingJar.direction)
                      setPendingJar(null)
                    }}
                    onDragEnter={() => {
                      if (canReceiveDraggedSource) setOpenJarKey(activeJarKey)
                    }}
                    onDragOver={(event) => {
                      if (canReceiveDraggedSource) {
                        event.preventDefault()
                        setOpenJarKey(activeJarKey)
                      } else {
                        setOpenJarKey((openKey) => openKey === activeJarKey ? null : openKey)
                      }
                    }}
                    onDrop={(event) => {
                      if (!canReceiveDraggedSource || !draggedSource || !activeBudgetDetail || draggedSource.id === undefined) return
                      event.preventDefault()
                      budgetDropHandled.current = true
                      setBudgetExpenseSourceId(draggedSource.id)
                      setBudgetExpenseTarget(activeBudgetDetail)
                      setBudgetExpenseAmount('')
                      setOpenJarKey(activeJarKey)
                    }}
                    onDragLeave={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                        setOpenJarKey((openKey) => openKey === activeJarKey ? null : openKey)
                      }
                    }}
                  >
                    <button
                      className="budget-jar-toggle"
                      type="button"
                      aria-label={activeBudgetDetail ? `Chọn danh mục ngân sách, hiện tại là ${activeBudgetDetail.category}` : 'Thêm danh mục'}
                      aria-expanded={activeBudgetDetail ? isBudgetPickerOpen : isHomeCategoryFormOpen}
                      onClick={() => {
                        if (!activeBudgetDetail?.id) {
                          setIsHomeCategoryFormOpen(true)
                          return
                        }
                        if (isBudgetPickerOpen) closeBudgetPicker()
                        else openBudgetPicker()
                      }}
                    >
                      <div className="mochi-jar-illustration" aria-hidden="true">
                        <span className={`jar-lid${isActiveJarOpen ? ' open' : ''}`} />
                        <span className="jar-glass">
                          {!activeBudgetDetail && <span className="empty-jar-add-icon">+</span>}
                          {Array.from({ length: activeBudgetDetail ? budgetMochiCount(activeBudgetDetail) : 0 }, (_, index) => (
                            <MochiMascot className="jar-mochi" key={index} />
                          ))}
                          {mochiDropId > 0 && (
                            <MochiMascot key={`falling-${mochiDropId}`} className="falling-mochi" onAnimationEnd={() => setMochiDropId(0)} />
                          )}
                        </span>
                      </div>
                    </button>
                    <p className="featured-jar-type">{new Date(`${localToday}T00:00:00`).toLocaleDateString('vi-VN')}</p>
                    <h3>{activeBudgetDetail?.category ?? 'Chưa có danh mục'}</h3>
                    {activeBudgetDetail?.note && <p className="featured-jar-note">{activeBudgetDetail.note}</p>}
                    {activeBudgetDetail && (
                      <strong className="featured-jar-balance">
                        {activeBudgetDetail.limit > 0
                          ? `${formatMoney(spentForBudget(activeBudgetDetail))} / ${formatMoney(activeBudgetDetail.limit)}`
                          : formatMoney(spentForBudget(activeBudgetDetail))}
                      </strong>
                    )}
                    {activeBudgetDetail && activeBudgetDetail.limit > 0 && (
                      <p className="featured-jar-spending">
                        Đã dùng / ngân sách · còn {formatMoney(remainingForBudget(activeBudgetDetail))}
                      </p>
                    )}
                    {activeBudgetDetail && activeBudgetDetail.limit <= 0 && (
                      <p className="featured-jar-spending">Chưa đặt ngân sách</p>
                    )}
                  </div>

                  <section className="home-category-creator" aria-label="Tạo danh mục">
                    {isHomeCategoryFormOpen ? (
                      <form className="home-category-form" onSubmit={saveHomeCategory}>
                        <label>
                          Tên danh mục
                          <input
                            autoFocus
                            autoCorrect="on"
                            spellCheck
                            value={homeCategoryName}
                            onChange={(event) => setHomeCategoryName(event.target.value)}
                            placeholder="Ví dụ: Ăn uống"
                            required
                          />
                        </label>
                        <label>
                          Ghi chú (không bắt buộc)
                          <input
                            value={homeCategoryNote}
                            onChange={(event) => setHomeCategoryNote(event.target.value)}
                            maxLength={200}
                            placeholder="Ví dụ: Chi phí ăn uống hàng ngày"
                          />
                        </label>
                        <label>
                          Ngân sách (không bắt buộc)
                          <MOAmountInput
                            value={homeCategoryBudgetLimit}
                            onChange={setHomeCategoryBudgetLimit}
                            placeholder="Để trống nếu chưa muốn đặt"
                          />
                        </label>
                        <div className="home-category-form-actions">
                          <button className="quiet-button" type="button" onClick={() => {
                            setIsHomeCategoryFormOpen(false)
                            setHomeCategoryName('')
                            setHomeCategoryNote('')
                            setHomeCategoryBudgetLimit('')
                          }}>Hủy</button>
                          <button className="primary-button" type="submit">Tạo danh mục</button>
                        </div>
                      </form>
                    ) : null}
                  </section>

                  {budgetExpenseTarget && (
                    <form className="budget-expense-chat" onSubmit={saveBudgetExpense} role="dialog" aria-label="Ghi khoản chi ngân sách">
                      <p>Chi bao nhiêu MO cho {budgetExpenseTarget.category}?</p>
                      <p>Nguồn: {selectedBudgetExpenseSource ? sourceLabel(selectedBudgetExpenseSource) : 'Chưa chọn'}</p>
                      <label>
                        Số MO chi
                        <MOAmountInput
                          value={budgetExpenseAmount}
                          onChange={setBudgetExpenseAmount}
                          required
                        />
                      </label>
                      <div className="budget-expense-chat-actions">
                        <button className="quiet-button" type="button" onClick={() => {
                          setBudgetExpenseTarget(null)
                          setBudgetExpenseSourceId(null)
                          setOpenJarKey(null)
                        }}>Hủy</button>
                        {budgetExpenseSourceId === null ? (
                          <button className="primary-button" type="button" onClick={() => {
                            setBudgetExpenseTarget(null)
                            setBudgetExpenseSourceId(null)
                            setOpenJarKey(null)
                            setPage('sources')
                          }}>Tạo nguồn</button>
                        ) : (
                          <button className="primary-button" type="submit">Xác nhận</button>
                        )}
                      </div>
                    </form>
                  )}

                </div>
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
                <Charts
                  totalIncome={totalIncome}
                  totalExpense={totalExpense}
                  netWorth={netWorth}
                  totalDebt={totalDebt}
                  totalLent={totalLent}
                  cashflowMonths={cashflowMonths}
                  cashflowMax={cashflowMax}
                  expenseCategoryTotals={expenseCategoryTotals}
                  formatMoney={formatMoney}
                />
              )}

              {page === 'wardrobe' && (
                <Wardrobe
                  mochiPoints={mochiPoints}
                  unlockedAccessories={unlockedAccessories}
                  mochiOutfit={mochiOutfit}
                  outfitHasChanges={outfitHasChanges}
                  onSaveMochiOutfit={saveMochiOutfit}
                  onSelectAccessory={selectAccessory}
                  onUpdateMochiColor={updateMochiColor}
                  onUpdateMochiExpression={updateMochiExpression}
                />
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
                    {editingBudgetId === null && frequentCategories.length > 0 && (
                      <div className="frequent-budget-categories" aria-label="Danh mục chi tiêu thường xuyên">
                        <span>Danh mục thường xuyên</span>
                        <div>
                          {frequentCategories.map((frequentCategory) => (
                            <button
                              className={budgetCategory === frequentCategory ? 'active' : ''}
                              key={frequentCategory}
                              type="button"
                              onClick={() => setBudgetCategory(frequentCategory)}
                            >{frequentCategory}</button>
                          ))}
                        </div>
                      </div>
                    )}
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
                                <button type="button" className="text-button" onClick={() => { setEditingBudgetId(budget.id ?? null); setBudgetCategory(budget.category); setBudgetLimit(String(budget.limit)); setBudgetMonth(budget.month); scrollToForm('[data-tour-target="budgets-form"]') }}>Sửa</button>
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
                  <div className="task-page-overview">
                    <section className="content-card task-intro" data-tour-target="tasks-intro">
                      <div><SectionHeading title="Nhiệm vụ" detail="Sao được cộng hoặc trừ tự động theo hoạt động của bạn." /></div>
                      <button
                        className="secondary-button"
                        type="button"
                        aria-expanded={isPointsGuideOpen}
                        aria-controls="points-guide"
                        onClick={() => setIsPointsGuideOpen((open) => !open)}
                      >
                        {isPointsGuideOpen ? 'Đóng hướng dẫn' : '☆ Cách nhận sao'}
                      </button>
                    </section>
                    {isPointsGuideOpen && (
                      <aside id="points-guide" className="content-card points-guide" aria-label="Hướng dẫn nhận sao">
                        <h2>Hướng dẫn nhận sao</h2>
                        <ul>
                          <li>Điểm danh mỗi ngày: <strong>+1 sao</strong></li>
                          <li>Đạt mục tiêu tiết kiệm: <strong>+1 sao</strong></li>
                          <li>Chi vượt ngân sách từ 10%: <strong>−1 sao</strong> mỗi danh mục mỗi tháng</li>
                          <li>Đổi phụ kiện: trừ sao theo giá món đồ</li>
                        </ul>
                      </aside>
                    )}
                  </div>
                  <section className="dashboard-list-section" data-tour-target="tasks-list">
                    <SectionHeading title="Danh sách nhiệm vụ" detail={`${tasks.length} mục đã lưu`} />
                    {tasks.length === 0 ? <EmptyState text="Các thay đổi sao tự động sẽ được ghi lại trong lịch sử bên dưới." /> : (
                      <div className="card-list">
                        {tasks.map((task) => (
                          <article className={`content-card task-card${task.completed ? ' task-completed' : ''}`} key={task.id}>
                            <span className="task-check" aria-hidden="true">{task.completed ? '✓' : '○'}</span>
                            <div className="task-copy">
                              <h3>{task.title}</h3>
                              <p>
                                {task.completed
                                  ? `Đã hoàn thành${task.completedAt ? ' · tự xóa sau 3 ngày' : ''}`
                                  : task.goalId !== undefined
                                    ? `Tiến độ mục tiêu: ${Math.round(Math.min(100, ((goals.find((goal) => goal.id === task.goalId)?.savedAmount ?? 0) / Math.max(1, goals.find((goal) => goal.id === task.goalId)?.targetAmount ?? 1)) * 100))}%`
                                    : 'Nhiệm vụ cũ · không còn nhận sao thủ công'}
                              </p>
                            </div>
                            <button className="text-button danger-text task-delete-button" type="button" onClick={() => deleteTask(task)}>Xóa</button>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                  <section className="dashboard-list-section points-history-section" aria-label="Lịch sử sao">
                    <SectionHeading title="Lịch sử sao" detail={`${pointHistory.length} lần thay đổi`} />
                    {sortedPointHistory.length === 0 ? (
                      <EmptyState text="Chưa có thay đổi sao nào được ghi nhận." />
                    ) : (
                      <div className="card-list">
                        {sortedPointHistory.map((entry) => (
                          <article className="content-card points-history-entry" key={entry.id}>
                            <div>
                              <h3>{entry.reason}</h3>
                              <p>{new Date(entry.createdAt).toLocaleString('vi-VN')}</p>
                            </div>
                            <strong className={entry.amount > 0 ? 'points-added' : entry.amount < 0 ? 'points-deducted' : 'points-unchanged'}>
                              {entry.amount > 0 ? '+' : ''}{entry.amount} sao
                            </strong>
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
                      detail="Chọn nhóm nguồn và dấu cộng/trừ; bạn có thể tạo nhiều nguồn cùng loại."
                    />
                    <form className="form-grid" onSubmit={saveMoneySource}>
                      <label>Loại nguồn
                        <select
                          required
                          value={sourceType}
                          onChange={(event) => {
                            const nextType = event.target.value
                            setSourceType(nextType)
                            if (isDebitCardSource(nextType)) setSourceBalanceMode('debt')
                          }}
                        >
                          <option value="">Chọn loại nguồn</option>
                          {!moneySourceTypes.includes(sourceType) && sourceType && <option value={sourceType}>{sourceType}</option>}
                          {moneySourceTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                        </select>
                      </label>
                      <label>Ghi chú<input autoCorrect="on" spellCheck maxLength={50} value={sourceName} onChange={(event) => setSourceName(event.target.value)} placeholder="Ví dụ: tiền từ ai, tiền ban đầu..." /></label>
                      <label>Nhóm nguồn
                        <select
                          required
                          value={sourceFinancialKind}
                          onChange={(event) => setSourceFinancialKind(event.target.value as MoneySourceFinancialKind | '')}
                        >
                          <option value="">Chọn nhóm nguồn</option>
                          {Object.entries(moneySourceFinancialKindLabels).map(([kind, label]) => (
                            <option key={kind} value={kind}>{label}</option>
                          ))}
                        </select>
                      </label>
                      <label>Dấu khi tính Tổng cộng
                        <select
                          value={sourceBalanceMode}
                          onChange={(event) => setSourceBalanceMode(event.target.value as MoneySourceBalanceMode)}
                        >
                          <option value="asset">+ Cộng vào Tổng cộng</option>
                          <option value="debt">− Trừ khỏi Tổng cộng</option>
                        </select>
                        <small className="source-accounting-hint">Chọn dấu “−” cho khoản nợ.</small>
                      </label>
                      {isDebitCardSource(sourceType) && (
                        <>
                          <label>Hạn mức thẻ ban đầu (MO)
                            <MOAmountInput
                              value={sourceCreditLimit}
                              onChange={setSourceCreditLimit}
                              placeholder="Nhập hạn mức"
                              required
                            />
                          </label>
                          <label className="source-total-toggle">
                            <input
                              type="checkbox"
                              checked={sourceIncludeInTotal}
                              onChange={(event) => setSourceIncludeInTotal(event.target.checked)}
                            />
                            <span>Tính khoản nợ thẻ vào Tổng cộng</span>
                          </label>
                        </>
                      )}
                      <details className="form-advanced">
                        <summary>Tùy chọn nâng cao</summary>
                        <div className="form-advanced-content">
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
                      <label>{sourceBalanceMode === 'debt' ? 'Tiền ban đầu (nợ)' : 'Tiền ban đầu'}<MOAmountInput value={sourceInitialBalance} onChange={setSourceInitialBalance} placeholder="0" allowNegative={sourceBalanceMode !== 'debt'} required /></label>
                      {sourceBalanceMode !== 'debt' && <small className="source-accounting-hint">Số dư âm sẽ tự động được tính vào tổng nợ MO.</small>}
                      <div className="form-actions">
                        <button className="primary-button" type="submit">{editingSourceId === null ? '+ Thêm nguồn MO' : 'Lưu thay đổi'}</button>
                        {editingSourceId !== null && <button className="quiet-button" type="button" onClick={() => { setEditingSourceId(null); setSourceName(''); setSourceType(''); setSourceFinancialKind(''); setSourceInitialBalance('0'); setSourceCreditLimit(''); setSourceIncludeInTotal(true); setSourceBalanceMode('asset'); setSourceOpeningDate(today()) }}>Hủy</button>}
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
                                <div><h3>{source.type}</h3><p>{source.name.trim() || 'Chưa có ghi chú'}{source.financialKind ? ` · ${moneySourceFinancialKindLabels[source.financialKind]}` : ''}</p></div>
                                <span className="status-pill">{linkedTransactions} giao dịch</span>
                              </div>
                              <div className="money-source-balance">
                                <span>{isSourceDebt(source) ? 'Nợ hiện tại' : 'Số dư hiện tại'}</span>
                                <strong>{formatMoney(sourceDisplayBalance(source))}</strong>
                              </div>
                              <p className="money-source-starting">{source.balanceMode === 'debt' || source.initialBalance < 0 ? 'Nợ ban đầu' : 'Số dư MO ban đầu'}: {formatMoney(Math.abs(source.initialBalance))} · {isSourceDebt(source) ? 'Khoản nợ' : 'MO có sẵn'}</p>
                              {isDebitCardSource(source.type) && source.creditLimit !== undefined && (
                                <p className="money-source-starting">
                                  Hạn mức {formatMoney(source.creditLimit)} · Còn dùng {formatMoney(Math.max(0, source.creditLimit - sourceDisplayBalance(source)))}
                                  {source.includeInTotal === false ? ' · Không tính vào Tổng cộng' : ''}
                                </p>
                              )}
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
                    <div className="settings-backup">
                      <h3>Sao lưu và khôi phục</h3>
                      <p>Bản sao lưu JSON bao gồm dữ liệu tài chính và tùy chỉnh giao diện, nhưng không chứa tài khoản hoặc mật khẩu.</p>
                      <div className="settings-backup-actions">
                        <button className="secondary-button" type="button" onClick={exportAccountBackup}>
                          Xuất dữ liệu dự phòng (JSON)
                        </button>
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => backupFileInput.current?.click()}
                          disabled={isImportingBackup}
                        >
                          {isImportingBackup ? 'Đang nhập…' : 'Nhập dữ liệu'}
                        </button>
                        <input
                          ref={backupFileInput}
                          className="visually-hidden"
                          type="file"
                          accept="application/json,.json"
                          aria-label="Chọn tệp sao lưu Mochi dạng JSON"
                          onChange={importAccountBackup}
                        />
                      </div>
                    </div>
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
                  <section className="transactions-recent-summary" aria-label="Tổng kết giao dịch ba ngày gần nhất">
                    <SummaryCard label="Thu · 3 ngày" value={formatMoney(threeDayIncome)} tone="income" />
                    <SummaryCard label="Chi · 3 ngày" value={formatMoney(threeDayExpense)} tone="expense" />
                    <SummaryCard label="Chênh lệch · 3 ngày" value={formatMoney(threeDayIncome - threeDayExpense)} tone="balance" />
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

        <div className="home-transaction-bubbles" aria-live="polite" aria-label="Giao dịch mới">
          {floatingTransactions.map((transaction, index) => (
            <button
              className={`home-transaction-bubble ${transaction.type}`}
              key={transaction.id}
              type="button"
              style={{ bottom: `calc(${18 + index * 76}px + env(safe-area-inset-bottom))` }}
              onClick={() => openFloatingTransaction(transaction)}
              aria-label={`Mở giao dịch ${transaction.category} để chỉnh sửa`}
            >
              <span>{transactionTypeLabels[transaction.type]}</span>
              <strong>{formatMoney(transaction.amount)}</strong>
              <span>{transaction.category}</span>
            </button>
          ))}
        </div>
        <button key={pointsPulse} className="task-points-bubble" type="button" onClick={() => setPage('tasks')} aria-label={`${mochiPoints} sao Mochi`} title="Điểm nhiệm vụ">
          <span className="task-points-star" aria-hidden="true">★</span>
          <strong>{mochiPoints}</strong>
          <span className="task-points-unit">sao</span>
          <span className="task-points-spark" aria-hidden="true">✦</span>
        </button>

        <AssistantWidget
          username={username}
          isOpen={assistantOpen}
          onOpenChange={setAssistantOpen}
          appearance={savedMochiOutfit}
          financeSnapshot={chiChatSnapshot}
        />
        {isCategorySetupOpen && username && (
          <div className="category-setup-overlay">
            <section className="category-setup-dialog" role="dialog" aria-modal="true" aria-labelledby="category-setup-title">
              <p className="category-setup-eyebrow">BƯỚC THIẾT LẬP</p>
              <h2 id="category-setup-title">Bạn thường chi tiêu cho những gì?</h2>
              <p>Chọn hoặc thêm danh mục thường xuyên. Bạn có thể dùng chúng làm gợi ý khi tạo hũ ngân sách sau này.</p>
              {error && <p className="category-setup-error" role="alert">{error}</p>}
              <div className="category-setup-options">
                {categorySetupOptions.map((option) => (
                  <label className={categorySetupSelection.includes(option) ? 'selected' : ''} key={option}>
                    <input
                      type="checkbox"
                      checked={categorySetupSelection.includes(option)}
                      onChange={() => toggleSetupCategory(option)}
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
              <form className="category-setup-add" onSubmit={(event) => {
                event.preventDefault()
                addSetupCategory()
              }}>
                <input
                  value={newSetupCategory}
                  onChange={(event) => setNewSetupCategory(event.target.value)}
                  placeholder="Thêm danh mục khác"
                  aria-label="Tên danh mục chi tiêu thường xuyên"
                />
                <button type="submit" aria-label="Thêm danh mục">+</button>
              </form>
              <div className="category-setup-actions">
                <button type="button" className="quiet-button" onClick={() => finishCategorySetup(false)}>Bỏ qua</button>
                <button type="button" className="primary-button" onClick={() => finishCategorySetup(true)}>Lưu và bắt đầu</button>
              </div>
            </section>
          </div>
        )}
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

export default App
