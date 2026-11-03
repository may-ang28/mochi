function MochiWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`mochi-wordmark${compact ? ' compact' : ''}`} aria-label="Mochi logo">
      <img className="mochi-logo-svg" src={`${import.meta.env.BASE_URL}mochi-logo.svg`} alt="Mochi" />
    </div>
  )
}

export default MochiWordmark
