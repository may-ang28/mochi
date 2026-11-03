import type { MoneySource, Transaction } from '../db'

export const isAssetSource = (source: MoneySource) => source.balanceMode !== 'debt'

export const getSourceBalance = (source: MoneySource, transactions: Transaction[]) => {
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

export const isSourceDebt = (source: MoneySource, transactions: Transaction[]) =>
  source.balanceMode === 'debt' || getSourceBalance(source, transactions) < 0

export const getSourceDisplayBalance = (source: MoneySource, transactions: Transaction[]) =>
  isSourceDebt(source, transactions)
    ? Math.abs(getSourceBalance(source, transactions))
    : getSourceBalance(source, transactions)

const getOpeningBalanceNetWorth = (source: MoneySource) =>
  source.balanceMode === 'debt' ? -Math.max(0, source.initialBalance) : source.initialBalance

const getTransactionNetWorthChange = (
  transaction: Transaction,
  includedSources: MoneySource[],
) => {
  if (transaction.isOpeningBalance) return 0

  return includedSources.reduce((change, source) => {
    if (source.balanceMode === 'debt') {
      if (transaction.relatedSourceId === source.id && transaction.type === 'cardPayment') {
        return change + transaction.amount
      }
      if (transaction.sourceId !== source.id) return change
      if (transaction.type === 'expense') return change - transaction.amount
      if (transaction.type === 'income') return change + transaction.amount
      return change
    }
    if (transaction.sourceId !== source.id) return change
    if (['income', 'borrow', 'collect'].includes(transaction.type)) return change + transaction.amount
    if (['expense', 'repay', 'lend', 'cardPayment'].includes(transaction.type)) return change - transaction.amount
    return change
  }, 0)
}

export const calculateFinancialTotals = (
  transactions: Transaction[],
  moneySources: MoneySource[],
) => {
  const includedSources = moneySources.filter((source) => source.includeInTotal !== false)
  let totalIncome = 0
  let totalExpense = 0

  for (const source of includedSources) {
    const openingBalance = getOpeningBalanceNetWorth(source)
    if (openingBalance > 0) totalIncome += openingBalance
    else totalExpense -= openingBalance
  }

  for (const transaction of transactions) {
    const change = getTransactionNetWorthChange(transaction, includedSources)
    if (change > 0) totalIncome += change
    else totalExpense -= change
  }

  const netWorth = includedSources.reduce((sum, source) => {
    const balance = getSourceBalance(source, transactions)
    return sum + (source.balanceMode === 'debt' ? -balance : balance)
  }, 0)
  const reconciliation = netWorth - (totalIncome - totalExpense)
  if (reconciliation > 0) totalIncome += reconciliation
  else totalExpense -= reconciliation

  return { totalIncome, totalExpense, netWorth }
}