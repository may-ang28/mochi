function EmptyState({ text }: { text: string }) {
  return <div className="empty-state"><span aria-hidden="true">🌷</span><p>{text}</p></div>
}

export default EmptyState
