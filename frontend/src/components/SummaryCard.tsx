function SummaryCard({ label, value, tone }: { label: string; value: string; tone: 'income' | 'expense' | 'balance' | 'debt' | 'lent' }) {
  return <article className={`summary-card ${tone}`}><p>{label}</p><strong>{value}</strong></article>
}

export default SummaryCard
