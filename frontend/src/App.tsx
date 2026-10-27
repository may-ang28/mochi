import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  db,
  type Budget,
  type Goal,
  type GoalContribution,
  type MoneySource,
  type MoneySourceBalanceMode,
  type MoneySourceFinancialKind,
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

const formatTransactionDate = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Intl.DateTimeFormat('vi-VN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, day, 12))
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

const isAssetSource = (source: MoneySource) => source.balanceMode !== 'debt'
const sourceLabel = (source: MoneySource) => source.name.trim() || source.type

function MoneySourceIcon({ sourceType }: { sourceType: string }) {
  const normalizedType = sourceType.toLocaleLowerCase('vi')
  const iconType = normalizedType.includes('tiền mặt') || normalizedType.includes('cash')
    ? 'cash'
    : normalizedType.includes('ngân hàng') || normalizedType.includes('tài khoản') || normalizedType.includes('bank')
      ? 'bank'
      : normalizedType.includes('thẻ') || normalizedType.includes('card')
        ? 'card'
        : normalizedType.includes('ví') || normalizedType.includes('wallet')
          ? 'wallet'
          : 'other'

  return (
    <svg className={`source-bubble-icon source-bubble-icon-${iconType}`} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      {iconType === 'cash' ? (
        <>
          <rect x="5" y="12" width="38" height="25" rx="5" />
          <circle cx="24" cy="24.5" r="6" />
          <path d="M10 18c3 0 5-2 5-4M38 31c-3 0-5 2-5 4" />
        </>
      ) : iconType === 'bank' ? (
        <>
          <path d="m5 17 19-11 19 11v3H5z" />
          <path d="M9 22h30M7 39h34M11 24v12m9-12v12m8-12v12m9-12v12" />
        </>
      ) : iconType === 'card' ? (
        <>
          <rect x="5" y="10" width="38" height="28" rx="6" />
          <path d="M6 19h36" />
          <rect x="11" y="27" width="10" height="4" rx="2" />
        </>
      ) : iconType === 'wallet' ? (
        <>
          <path d="M8 13h29a4 4 0 0 1 4 4v20H10a5 5 0 0 1-5-5V16a3 3 0 0 1 3-3Z" />
          <path d="M7 13V9a3 3 0 0 1 3-3h25v7m-1 9h8v8h-8a4 4 0 0 1 0-8Z" />
          <circle cx="34" cy="26" r="1" />
        </>
      ) : (
        <>
          <circle cx="24" cy="24" r="17" />
          <path d="M28 17c-1-2-3-3-5-3-3 0-5 2-5 4 0 7 12 3 12 10 0 3-3 6-7 6-3 0-6-2-7-4m8-19v24" />
        </>
      )}
    </svg>
  )
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
  const [showHomeFinancialDetails, setShowHomeFinancialDetails] = useState(false)
  const [activeBudgetIndex, setActiveBudgetIndex] = useState(0)
  const [jarMotionDirection, setJarMotionDirection] = useState<'left' | 'right' | null>('right')
  const [pendingJar, setPendingJar] = useState<{ index: number; direction: 'left' | 'right' } | null>(null)
  const [openJarKey, setOpenJarKey] = useState<string | null>(null)
  const [draggedSourceId, setDraggedSourceId] = useState<number | null>(null)
  const [budgetExpenseSourceId, setBudgetExpenseSourceId] = useState<number | null>(null)
  const [budgetExpenseTarget, setBudgetExpenseTarget] = useState<Budget | null>(null)
  const [budgetExpenseAmount, setBudgetExpenseAmount] = useState('')
  const [mochiDropId, setMochiDropId] = useState(0)
  const budgetDropHandled = useRef(false)
  const touchSourceDrag = useRef<{ sourceId: number; startX: number; startY: number; moved: boolean } | null>(null)
  const suppressSourceClick = useRef(false)
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
  const [expandedBudgetId, setExpandedBudgetId] = useState<number | null>(null)
  const [activeBudgetSubcategory, setActiveBudgetSubcategory] = useState<string | null>(null)
  const [showNewBudgetSubcategory, setShowNewBudgetSubcategory] = useState(false)
  const [newBudgetSubcategory, setNewBudgetSubcategory] = useState('')

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
        setMoneySourceTypes(readOptionList(MONEY_SOURCE_TYPES_KEY, defaultMoneySourceTypes))
        setCategoryOptions(readOptionList(
          CATEGORY_OPTIONS_KEY,
          defaultCategoryOptions,
          allTransactions.filter((transaction) => !transaction.isOpeningBalance).map((transaction) => transaction.category),
        ))
        setFrequentCategories(readOptionList(FREQUENT_CATEGORY_OPTIONS_KEY, []))
        setMochiPoints(savedPoints?.total ?? 0)
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

  const exportAccountBackup = () => {
    void runAction(async () => {
      const [allTransactions, allBudgets, allGoals, allGoalContributions, allTasks, allMoneySources, allPoints] =
        await Promise.all([
          db.transactions.toArray(),
          db.budgets.toArray(),
          db.goals.toArray(),
          db.goalContributions.toArray(),
          db.tasks.toArray(),
          db.moneySources.toArray(),
          db.points.toArray(),
        ])
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
        try {
          oldPreferences.forEach(({ key, value }) => {
            if (value === null) localStorage.removeItem(key)
            else localStorage.setItem(key, value)
          })
        } catch {
          throw new Error('Không thể hoàn tất nhập bản sao lưu hoặc khôi phục tùy chỉnh cũ. Hãy kiểm tra dữ liệu Mochi trước khi thử lại.')
        }
        throw importError
      }

      window.location.reload()
    }).finally(() => setIsImportingBackup(false))
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
      const source = moneySources.find((item) => item.id === budgetExpenseSourceId)
      if (!source || source.id === undefined) {
        throw new Error('Hãy chọn một nguồn MO trước khi ghi khoản chi này.')
      }
      const expenseCategory = activeBudgetSubcategory &&
        budgetExpenseTarget.subcategories?.includes(activeBudgetSubcategory)
        ? activeBudgetSubcategory
        : budgetExpenseTarget.category

      await db.transactions.add({
        type: 'expense',
        amount: value,
        category: expenseCategory,
        note: expenseCategory === budgetExpenseTarget.category
          ? `Chi cho ${budgetExpenseTarget.category}`
          : `Chi cho ${budgetExpenseTarget.category} · ${expenseCategory}`,
        date: today(),
        sourceId: source.id,
      })
      await refreshTransactions()
      setBudgetExpenseTarget(null)
      setBudgetExpenseAmount('')
      setBudgetExpenseSourceId(null)
      setActiveBudgetSubcategory(null)
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
    (sum, source) => sum + (source.includeInTotal === false
      ? 0
      : source.balanceMode === 'debt' ? -sourceBalance(source) : sourceBalance(source)),
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
        [budget.category, ...(budget.subcategories ?? [])].includes(transaction.category) &&
        transaction.date.startsWith(budget.month),
      )
      .reduce((sum, transaction) => sum + transaction.amount, 0)
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
  const recentTransactions = transactions
    .filter((transaction) =>
      !transaction.isOpeningBalance &&
      transaction.date >= getLocalDateDaysAgo(3) &&
      transaction.date <= localToday,
    )
    .sort((first, second) => second.date.localeCompare(first.date))
    .slice(0, 5)
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
  const incomingBudget = pendingJar ? homeBudgets[pendingJar.index] : undefined
  const addBudgetSubcategory = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!activeBudgetDetail?.id) return
    const newSubcategory = newBudgetSubcategory.trim()
    if (!newSubcategory) return
    if ((activeBudgetDetail.subcategories ?? []).some((item) =>
      item.toLocaleLowerCase('vi-VN') === newSubcategory.toLocaleLowerCase('vi-VN'),
    )) {
      setError('Danh mục nhỏ này đã tồn tại trong hũ.')
      return
    }
    void runAction(async () => {
      const subcategories = [...(activeBudgetDetail.subcategories ?? []), newSubcategory]
      await db.budgets.put({ ...activeBudgetDetail, subcategories })
      await refreshBudgets()
      setNewBudgetSubcategory('')
      setShowNewBudgetSubcategory(false)
      setActiveBudgetSubcategory(newSubcategory)
      if (!categoryOptions.includes(newSubcategory)) {
        persistCategoryOptions([...categoryOptions, newSubcategory])
      }
    })
  }
  const beginJarTransition = (index: number, direction: 'left' | 'right') => {
    if (pendingJar) return
    if (index === safeBudgetIndex || !homeBudgets.length) return
    setPendingJar({ index, direction })
    setActiveBudgetSubcategory(null)
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

        <main className={`workspace-main${page === 'home' ? ' workspace-main-home' : ''}`}>
          {page === 'home' ? (
            <div className="home-dashboard">
              <section className="home-streak" aria-label="Điểm danh hằng ngày" data-tour-target="home-checkin">
                <span className="streak-mascot"><MochiMascot /></span>
                <div>
                  <p className="dashboard-eyebrow">GÓC NHỎ CỦA BẠN</p>
                </div>
              </section>

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
                            onTouchStart={(event) => {
                              const touch = event.changedTouches[0]
                              touchSourceDrag.current = { sourceId, startX: touch.clientX, startY: touch.clientY, moved: false }
                              budgetDropHandled.current = false
                              setDraggedSourceId(sourceId)
                            }}
                            onTouchMove={(event) => {
                              const touchDrag = touchSourceDrag.current
                              if (!touchDrag) return
                              const touch = event.changedTouches[0]
                              if (Math.hypot(touch.clientX - touchDrag.startX, touch.clientY - touchDrag.startY) > 12) {
                                touchDrag.moved = true
                                event.preventDefault()
                              }
                            }}
                            onTouchEnd={(event) => {
                              const touchDrag = touchSourceDrag.current
                              touchSourceDrag.current = null
                              if (!touchDrag) return
                              suppressSourceClick.current = touchDrag.moved
                              if (touchDrag.moved) {
                                const touch = event.changedTouches[0]
                                const targetJar = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('[data-budget-drop-target]')
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
                            onTouchCancel={() => {
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

                <div className="budget-jar-strip" aria-label="Điều hướng danh mục ngân sách">
                  <button
                    type="button"
                    className="jar-arrow budget-arrow"
                    aria-label="Danh mục ngân sách trước"
                    disabled={homeBudgets.length <= 1 || Boolean(pendingJar)}
                    onClick={() => beginJarTransition((safeBudgetIndex - 1 + homeBudgets.length) % homeBudgets.length, 'left')}
                  >←</button>
                  <span className="budget-category-position">
                    {homeBudgets.length ? `${safeBudgetIndex + 1} / ${homeBudgets.length}` : '0 / 0'}
                  </span>
                  <button
                    type="button"
                    className="jar-arrow budget-arrow"
                    aria-label="Danh mục ngân sách tiếp theo"
                    disabled={homeBudgets.length <= 1 || Boolean(pendingJar)}
                    onClick={() => beginJarTransition((safeBudgetIndex + 1) % homeBudgets.length, 'right')}
                  >→</button>
                </div>

                <div className="home-jar-stage">
                  <div
                    key={activeBudgetDetail?.id ?? activeBudgetDetail?.category ?? 'budget-jar'}
                    className={`featured-jar budget-featured-jar${pendingJar ? ` exit-${pendingJar.direction === 'right' ? 'left' : 'right'}` : jarMotionDirection ? ` ${jarMotionDirection}` : ''}${isActiveJarOpen || canReceiveDraggedSource ? ' open' : ''}${canReceiveDraggedSource ? ' drop-ready' : ''}`}
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
                      disabled={!activeBudgetDetail}
                      aria-label={activeBudgetDetail ? `Mở danh mục nhỏ của hũ ${activeBudgetDetail.category}` : 'Hũ danh mục'}
                      aria-expanded={activeBudgetDetail?.id !== undefined && expandedBudgetId === activeBudgetDetail.id}
                      onClick={() => {
                        if (!activeBudgetDetail?.id) return
                        setExpandedBudgetId((id) => id === activeBudgetDetail.id ? null : activeBudgetDetail.id!)
                      }}
                    >
                      <div className="mochi-jar-illustration" aria-hidden="true">
                        <span className={`jar-lid${isActiveJarOpen ? ' open' : ''}`} />
                        <span className="jar-glass">
                          {Array.from({ length: activeBudgetDetail ? budgetMochiCount(activeBudgetDetail) : 0 }, (_, index) => (
                            <MochiMascot className="jar-mochi" key={index} />
                          ))}
                          {mochiDropId > 0 && (
                            <MochiMascot key={`falling-${mochiDropId}`} className="falling-mochi" onAnimationEnd={() => setMochiDropId(0)} />
                          )}
                        </span>
                      </div>
                    </button>
                    <p className="featured-jar-type">NGÂN SÁCH · {currentMonth()}</p>
                    <h3>{activeBudgetDetail?.category ?? 'Chưa có danh mục ngân sách'}</h3>
                    {activeBudgetDetail ? (
                      <strong className="featured-jar-balance">
                        {formatMoney(spentForBudget(activeBudgetDetail))} / {formatMoney(activeBudgetDetail.limit)}
                      </strong>
                    ) : (
                      <button className="primary-button" type="button" onClick={() => {
                        setPage('budgets')
                        setEditingBudgetId(null)
                        setBudgetCategory('')
                        setBudgetLimit('')
                        setBudgetMonth(currentMonth())
                      }}>Tạo danh mục ngân sách</button>
                    )}
                    {activeBudgetDetail && (
                      <p className="featured-jar-spending">
                        Đã dùng / ngân sách · còn {formatMoney(remainingForBudget(activeBudgetDetail))}
                      </p>
                    )}
                  </div>

                  {pendingJar && (
                    <div
                      key={`incoming-${pendingJar.index}`}
                      className={`featured-jar entering ${pendingJar.direction}`}
                      aria-hidden="true"
                    >
                      <div className="mochi-jar-illustration">
                        <span className="jar-lid" />
                        <span className="jar-glass">
                          {Array.from({ length: incomingBudget ? budgetMochiCount(incomingBudget) : 0 }, (_, index) => <MochiMascot className="jar-mochi" key={index} />)}
                        </span>
                      </div>
                      <p className="featured-jar-type">NGÂN SÁCH · {currentMonth()}</p>
                      <h3>{incomingBudget?.category ?? 'Danh mục ngân sách'}</h3>
                      <strong className="featured-jar-balance">
                        {incomingBudget ? `${formatMoney(spentForBudget(incomingBudget))} / ${formatMoney(incomingBudget.limit)}` : ''}
                      </strong>
                    </div>
                  )}

                  {budgetExpenseTarget && (
                    <form className="budget-expense-chat" onSubmit={saveBudgetExpense} role="dialog" aria-label="Ghi khoản chi ngân sách">
                      <p>Chi bao nhiêu MO cho {activeBudgetSubcategory ?? budgetExpenseTarget.category}?</p>
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
                {activeBudgetDetail && expandedBudgetId === activeBudgetDetail.id && (
                  <section className="budget-subcategories" aria-label={`Danh mục nhỏ của ${activeBudgetDetail.category}`}>
                    <p className="budget-subcategories-title">Danh mục nhỏ · {activeBudgetDetail.category}</p>
                    <div className="budget-subcategory-list">
                      <button
                        className={`budget-subcategory-chip${activeBudgetSubcategory === null ? ' active' : ''}`}
                        type="button"
                        aria-pressed={activeBudgetSubcategory === null}
                        onClick={() => setActiveBudgetSubcategory(null)}
                      >Tất cả</button>
                      {(activeBudgetDetail.subcategories ?? []).map((subcategory) => (
                        <button
                          className={`budget-subcategory-chip${activeBudgetSubcategory === subcategory ? ' active' : ''}`}
                          type="button"
                          key={subcategory}
                          aria-pressed={activeBudgetSubcategory === subcategory}
                          onClick={() => setActiveBudgetSubcategory(subcategory)}
                        >{subcategory}</button>
                      ))}
                      <button
                        className="budget-subcategory-add"
                        type="button"
                        aria-label="Thêm danh mục nhỏ"
                        onClick={() => setShowNewBudgetSubcategory((shown) => !shown)}
                      >+</button>
                    </div>
                    {showNewBudgetSubcategory && (
                      <form className="budget-subcategory-form" onSubmit={addBudgetSubcategory}>
                        <label>
                          Tên danh mục nhỏ
                          <input
                            autoFocus
                            value={newBudgetSubcategory}
                            onChange={(event) => setNewBudgetSubcategory(event.target.value)}
                            placeholder="Ví dụ: Cà phê"
                            required
                          />
                        </label>
                        <button className="primary-button" type="submit">Thêm</button>
                      </form>
                    )}
                  </section>
                )}
              </section>

              <section className="home-recent-transactions" aria-label="Giao dịch gần đây" data-tour-target="home-recent">
                <header className="home-section-heading">
                  <div>
                    <p className="dashboard-eyebrow">NHẬT KÝ</p>
                    <h2>Giao dịch gần đây</h2>
                  </div>
                  <span className="home-recent-caption">3 ngày gần nhất</span>
                </header>
                {recentTransactions.length === 0 ? (
                  <p className="home-empty-note">Chưa có giao dịch trong 3 ngày gần đây.</p>
                ) : (
                  <div className="home-recent-list">
                    {recentTransactions.map((transaction) => (
                      <div className={`home-chat-transaction ${transaction.type}`} key={transaction.id}>
                        <time className="home-chat-transaction-date" dateTime={transaction.date}>
                          {formatTransactionDate(transaction.date)}
                        </time>
                        <p className="home-chat-transaction-bubble">
                          {transaction.type === 'expense'
                            ? <>Bạn đã dùng {formatMoney(transaction.amount)} MO cho {transaction.category}</>
                            : <>{transactionTypeLabels[transaction.type]} · {formatMoney(transaction.amount)} MO · {transaction.category}</>}
                        </p>
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
                      detail="Chọn nhóm nguồn và dấu cộng/trừ; bạn có thể tạo nhiều nguồn cùng loại."
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
                                <div><h3>{sourceLabel(source)}</h3><p>{source.type}{source.financialKind ? ` · ${moneySourceFinancialKindLabels[source.financialKind]}` : ''}</p></div>
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

export default App
