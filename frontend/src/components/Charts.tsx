import EmptyState from './EmptyState'
import SectionHeading from './SectionHeading'
import SummaryCard from './SummaryCard'

type CashflowMonth = {
  key: string
  label: string
  income: number
  expense: number
}

function Charts({
  totalIncome,
  totalExpense,
  netWorth,
  totalDebt,
  totalLent,
  cashflowMonths,
  cashflowMax,
  expenseCategoryTotals,
  formatMoney,
}: {
  totalIncome: number
  totalExpense: number
  netWorth: number
  totalDebt: number
  totalLent: number
  cashflowMonths: CashflowMonth[]
  cashflowMax: number
  expenseCategoryTotals: [string, number][]
  formatMoney: (amount: number) => string
}) {
  return (
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
  )
}

export default Charts
