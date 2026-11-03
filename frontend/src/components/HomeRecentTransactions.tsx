import type { Transaction, TransactionType } from '../db'

function HomeRecentTransactions({
  transactions,
  transactionTypeLabels,
  formatTransactionDate,
  formatMoney,
}: {
  transactions: Transaction[]
  transactionTypeLabels: Record<TransactionType, string>
  formatTransactionDate: (dateKey: string) => string
  formatMoney: (amount: number) => string
}) {
  return (
    <section className="home-recent-transactions" aria-label="Giao dịch gần đây" data-tour-target="home-recent">
      <header className="home-section-heading">
        <div>
          <p className="dashboard-eyebrow">NHẬT KÝ</p>
          <h2>Giao dịch gần đây</h2>
        </div>
        <span className="home-recent-caption">3 ngày gần nhất</span>
      </header>
      {transactions.length === 0 ? (
        <p className="home-empty-note">Chưa có giao dịch trong 3 ngày gần đây.</p>
      ) : (
        <div className="home-recent-list">
          {transactions.map((transaction) => (
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
  )
}

export default HomeRecentTransactions
