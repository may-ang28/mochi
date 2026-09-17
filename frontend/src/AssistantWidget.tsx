import { useEffect, useRef, useState, type FormEvent } from 'react'
import './AssistantWidget.css'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type MascotExpression = 'happy' | 'curious' | 'sleepy'

type MascotPosition = { x: number; y: number; anchor: number }

const MASCOT_STOP_DURATION_MS = 30_000
const MASCOT_TRAVEL_DURATION_MS = 5_000

const getRandomEdgePosition = (previousAnchor?: number): MascotPosition => {
  const size = 70
  const inset = 24
  const width = Math.max(window.innerWidth, size + inset * 2)
  const height = Math.max(window.innerHeight, size + inset * 2)
  const right = width - size - inset
  const bottom = height - size - inset
  const randomBetween = (start: number, end: number) =>
    Math.round(start + Math.max(0, end - start) * Math.random())
  const anchors = [
    { x: inset, y: inset },
    { x: randomBetween(inset, Math.min(right, width * 0.35)), y: inset },
    { x: right, y: randomBetween(inset + 100, bottom - 100) },
    { x: right, y: bottom },
    { x: randomBetween(width * 0.35, width * 0.65 - size), y: bottom },
    { x: inset, y: randomBetween(inset + 100, bottom - 100) },
  ]
  const availableAnchors = anchors
    .map((_, index) => index)
    .filter((index) => index !== previousAnchor)
  const anchor = availableAnchors[Math.floor(Math.random() * availableAnchors.length)]
  return { ...anchors[anchor], anchor }
}

function AssistantWidget({ username }: { username: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMascotPaused, setIsMascotPaused] = useState(false)
  const [mascotPosition, setMascotPosition] = useState(getRandomEdgePosition)
  const [mascotExpression, setMascotExpression] = useState<MascotExpression>('happy')
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `Chào ${username}, mình là Mochi! Hôm nay mình có thể giúp gì cho bạn?`,
    },
  ])
  const [draft, setDraft] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState('')
  const conversationEndRef = useRef<HTMLDivElement>(null)
  const mascotRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isSending])

  useEffect(() => {
    if (isOpen || isMascotPaused) return
    const timer = window.setTimeout(() => {
      setMascotPosition((position) => getRandomEdgePosition(position.anchor))
    }, MASCOT_STOP_DURATION_MS + MASCOT_TRAVEL_DURATION_MS)
    return () => window.clearTimeout(timer)
  }, [isOpen, isMascotPaused, mascotPosition.anchor])

  const pauseMascot = () => {
    const bounds = mascotRef.current?.getBoundingClientRect()
    if (bounds) {
      setMascotPosition((position) => ({ ...position, x: bounds.left, y: bounds.top }))
    }
    setIsMascotPaused(true)
  }

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const content = draft.trim()

    if (!content || isSending) {
      return
    }

    const nextMessages = [...messages, { role: 'user' as const, content }]
    setMessages(nextMessages)
    setDraft('')
    setError('')
    setIsSending(true)

    try {
      const apiBaseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000')
        .replace(/\/+$/, '')
      const response = await fetch(`${apiBaseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages, username }),
      })
      const result = (await response.json()) as { reply?: string; error?: string }

      if (!response.ok || !result.reply) {
        throw new Error(result.error || 'Mochi chưa thể trả lời lúc này.')
      }

      setMessages([...nextMessages, { role: 'assistant', content: result.reply }])
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : 'Không kết nối được với Mochi. Bạn thử lại nhé.',
      )
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="assistant-widget">
      {isOpen && (
        <section className="assistant-panel" aria-label="Trò chuyện với Mochi">
          <header className="assistant-header">
            <div className="assistant-header-avatar"><SlimeMascot expression={mascotExpression} /></div>
            <div className="assistant-header-copy">
              <h2>Mochi</h2>
              <p>Trợ lý của bạn</p>
            </div>
            <button
              className="assistant-close"
              type="button"
              onClick={() => { setIsOpen(false); setIsMascotPaused(false) }}
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
            {isSending && (
              <div className="assistant-message assistant-message-assistant assistant-typing">
                Mochi đang nghĩ...
              </div>
            )}
            {error && <p className="assistant-error" role="alert">{error}</p>}
            <div ref={conversationEndRef} />
          </div>

          <form className="assistant-compose" onSubmit={sendMessage}>
            <label className="assistant-sr-only" htmlFor="assistant-message-input">
              Tin nhắn của bạn
            </label>
            <input
              id="assistant-message-input"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Nhắn gì đó cho Mochi..."
              maxLength={2000}
              disabled={isSending}
            />
            <button type="submit" disabled={!draft.trim() || isSending} aria-label="Gửi tin nhắn">
              Gửi
            </button>
          </form>
        </section>
      )}

      <button
        ref={mascotRef}
        className={`assistant-mascot${isOpen ? ' is-open' : ''}${isMascotPaused ? ' is-paused' : ''}`}
        style={{ left: `${mascotPosition.x}px`, top: `${mascotPosition.y}px` }}
        type="button"
        onClick={() => {
          setIsOpen((open) => !open)
          setIsMascotPaused(true)
          setMascotExpression((current) => current === 'happy' ? 'curious' : current === 'curious' ? 'sleepy' : 'happy')
        }}
        onPointerEnter={pauseMascot}
        onPointerLeave={() => setIsMascotPaused(false)}
        onPointerDown={pauseMascot}
        onFocus={pauseMascot}
        onBlur={() => setIsMascotPaused(false)}
        aria-label={isOpen ? 'Đóng trò chuyện với Mochi' : 'Trò chuyện với Mochi'}
        aria-expanded={isOpen}
      >
        <SlimeMascot expression={mascotExpression} />
      </button>
    </div>
  )
}

function SlimeMascot({ expression }: { expression: MascotExpression }) {
  return (
    <span className={`assistant-slime assistant-slime-${expression}`} aria-hidden="true">
      <span className="assistant-slime-eye assistant-slime-eye-left" />
      <span className="assistant-slime-eye assistant-slime-eye-right" />
      <span className="assistant-slime-mouth" />
      <span className="assistant-slime-blush" />
    </span>
  )
}

export default AssistantWidget