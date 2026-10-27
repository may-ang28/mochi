import { useEffect, useRef, useState } from 'react'
import type { MascotExpression } from './mascot'
import type { TransactionType } from './db'
import './AssistantWidget.css'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type MascotAppearance = {
  color: string
  expression: MascotExpression
  hat: string
  clip: string
}

type SummaryPeriod = 'day' | 'week' | 'month'

export type ChiChatSnapshot = {
  asOf: string
  transactions: Array<{
    date: string
    type: TransactionType
    amount: number
    category: string
  }>
  budgets: Array<{
    category: string
    limit: number
    spent: number
  }>
  goals: Array<{
    name: string
    targetAmount: number
    savedAmount: number
    deadline: string
    recentDailyContribution: number
  }>
}

const formatMO = (amount: number) =>
  `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(amount)} MO`

const parseDateKey = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

const getChiChatWarnings = (snapshot: ChiChatSnapshot) => {
  const asOf = parseDateKey(snapshot.asOf)
  const daysInMonth = new Date(asOf.getFullYear(), asOf.getMonth() + 1, 0).getDate()
  const elapsedDays = Math.max(1, asOf.getDate())
  const warnings: string[] = []

  for (const budget of snapshot.budgets) {
    if (budget.limit <= 0 || budget.spent <= 0) continue
    const usagePercent = (budget.spent / budget.limit) * 100

    if (budget.spent >= budget.limit) {
      warnings.push(`${budget.category}: đã vượt hạn mức ${formatMO(budget.spent - budget.limit)}.`)
      continue
    }

    const projectedSpend = (budget.spent / elapsedDays) * daysInMonth
    if (projectedSpend > budget.limit) {
      const dailyAverage = budget.spent / elapsedDays
      const expectedDay = Math.min(daysInMonth, Math.ceil(budget.limit / dailyAverage))
      warnings.push(`${budget.category}: nếu giữ nhịp chi hiện tại, có thể chạm hạn mức khoảng ngày ${expectedDay}.`)
    } else if (usagePercent >= 80) {
      warnings.push(`${budget.category}: đã dùng ${Math.round(usagePercent)}% ngân sách tháng.`)
    }
  }

  for (const goal of snapshot.goals) {
    const remaining = goal.targetAmount - goal.savedAmount
    if (remaining <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(goal.deadline)) continue
    const deadline = parseDateKey(goal.deadline)
    const daysRemaining = Math.ceil((deadline.getTime() - asOf.getTime()) / 86_400_000)

    if (daysRemaining < 0) {
      warnings.push(`${goal.name}: đã qua hạn, còn thiếu ${formatMO(remaining)}.`)
    } else if (daysRemaining <= 30) {
      const requiredDailyAmount = remaining / Math.max(1, daysRemaining)
      if (goal.recentDailyContribution < requiredDailyAmount) {
        warnings.push(`${goal.name}: còn ${daysRemaining} ngày, cần góp khoảng ${formatMO(requiredDailyAmount)} mỗi ngày để kịp hạn.`)
      }
    }
  }

  return warnings.slice(0, 4)
}

const getPeriodRange = (snapshot: ChiChatSnapshot, period: SummaryPeriod) => {
  const endDate = parseDateKey(snapshot.asOf)
  const startDate = new Date(endDate)
  if (period === 'week') {
    const daysSinceMonday = (startDate.getDay() + 6) % 7
    startDate.setDate(startDate.getDate() - daysSinceMonday)
    return { startDate, endDate, label: 'tuần này' }
  }
  if (period === 'month') {
    startDate.setDate(1)
    return { startDate, endDate, label: 'tháng này' }
  }
  return { startDate, endDate, label: 'hôm nay' }
}

const makePeriodSummary = (snapshot: ChiChatSnapshot, period: SummaryPeriod) => {
  const { startDate, endDate, label } = getPeriodRange(snapshot, period)
  const startKey = [
    startDate.getFullYear(),
    String(startDate.getMonth() + 1).padStart(2, '0'),
    String(startDate.getDate()).padStart(2, '0'),
  ].join('-')
  const endKey = [
    endDate.getFullYear(),
    String(endDate.getMonth() + 1).padStart(2, '0'),
    String(endDate.getDate()).padStart(2, '0'),
  ].join('-')
  const periodTransactions = snapshot.transactions.filter((transaction) =>
    transaction.date >= startKey && transaction.date <= endKey,
  )
  const income = periodTransactions
    .filter((transaction) => transaction.type === 'income')
    .reduce((sum, transaction) => sum + transaction.amount, 0)
  const expenseTransactions = periodTransactions.filter((transaction) => transaction.type === 'expense')
  const expense = expenseTransactions.reduce((sum, transaction) => sum + transaction.amount, 0)
  const net = income - expense
  const categoryTotals = [...expenseTransactions.reduce((totals, transaction) => {
    totals.set(transaction.category, (totals.get(transaction.category) ?? 0) + transaction.amount)
    return totals
  }, new Map<string, number>())]
    .sort((first, second) => second[1] - first[1])
    .slice(0, 3)
  const warnings = getChiChatWarnings(snapshot)
  const summaryLines = [
    `Đây là tổng kết ${label} nè:`,
    `Thu nhập: ${formatMO(income)}`,
    `Chi tiêu: ${formatMO(expense)}`,
    `Chênh lệch thu - chi: ${net >= 0 ? '+' : '−'}${formatMO(Math.abs(net))}`,
  ]

  if (categoryTotals.length) {
    summaryLines.push(`Chi nhiều nhất: ${categoryTotals.map(([category, amount]) => `${category} (${formatMO(amount)})`).join(', ')}.`)
  } else {
    summaryLines.push('Chưa có khoản chi nào được ghi trong khoảng thời gian này.')
  }

  if (warnings.length) {
    summaryLines.push(`Nhắc nhẹ: ${warnings.join(' ')}`)
  }

  return summaryLines.join('\n')
}

function AssistantWidget({
  username,
  isOpen,
  onOpenChange,
  appearance,
  financeSnapshot,
}: {
  username: string
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  appearance: MascotAppearance
  financeSnapshot: ChiChatSnapshot
}) {
  const mascotExpression = appearance.expression
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `Chào ${username}, mình là ChiChat. Bạn muốn xem thống kê khoảng thời gian nào?`,
    },
  ])
  const conversationEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const chooseSummary = (period: SummaryPeriod, label: string) => {
    setMessages((currentMessages) => [
      ...currentMessages,
      { role: 'user', content: label },
      { role: 'assistant', content: makePeriodSummary(financeSnapshot, period) },
    ])
  }

  return (
    <div className="assistant-widget">
      {isOpen && (
        <section className="assistant-panel" aria-label="Trò chuyện với ChiChat">
          <header className="assistant-header">
            <div className="assistant-header-avatar"><SlimeMascot expression={mascotExpression} appearance={appearance} /></div>
            <div className="assistant-header-copy">
              <h2>ChiChat</h2>
              <p>Thống kê thu chi của bạn</p>
            </div>
            <button
              className="assistant-close"
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Đóng khung chat"
            >
              ×
            </button>
          </header>

          <div className="assistant-messages" aria-live="polite">
            {messages.map((message, index) => (
              <div className={`assistant-message assistant-message-${message.role}`} key={`${index}-${message.role}`}>
                {message.content}
              </div>
            ))}
            <div ref={conversationEndRef} />
          </div>

          <div className="assistant-quick-replies" aria-label="Chọn nội dung muốn hỏi">
            <p>Bạn muốn xem gì?</p>
            <button type="button" onClick={() => chooseSummary('day', 'Tổng kết ngày hôm nay')}>Tổng kết ngày hôm nay</button>
            <button type="button" onClick={() => chooseSummary('week', 'Tổng kết tuần này')}>Tổng kết tuần này</button>
            <button type="button" onClick={() => chooseSummary('month', 'Tổng kết tháng này')}>Tổng kết tháng này</button>
          </div>
        </section>
      )}

      <button
        className={`assistant-mascot${isOpen ? ' is-open' : ''}`}
        type="button"
        onClick={() => onOpenChange(!isOpen)}
        aria-label={isOpen ? 'Đóng ChiChat' : 'Mở ChiChat'}
        aria-expanded={isOpen}
      >
        <SlimeMascot expression={mascotExpression} appearance={appearance} />
      </button>
    </div>
  )
}

function SlimeMascot({ expression, appearance }: { expression: MascotExpression; appearance: MascotAppearance }) {
  const hatIcon = ({ cap: '🧢', crown: '👑', berry: '🍓' } as Record<string, string>)[appearance.hat]
  const clipIcon = ({ bow: '🎀', flower: '🌼', star: '⭐' } as Record<string, string>)[appearance.clip]

  return (
    <span className={`assistant-mascot-character color-${appearance.color}`} aria-hidden="true">
      {hatIcon && <span className="assistant-mascot-accessory hat">{hatIcon}</span>}
      <span className={`assistant-slime assistant-slime-${expression}`}>
        <span className="assistant-slime-eye assistant-slime-eye-left" />
        <span className="assistant-slime-eye assistant-slime-eye-right" />
        <span className="assistant-slime-mouth" />
        <span className="assistant-slime-blush" />
      </span>
      {clipIcon && <span className="assistant-mascot-accessory clip">{clipIcon}</span>}
    </span>
  )
}

export default AssistantWidget
