import { useEffect, useRef, useState, type FormEvent } from 'react'
import './AssistantWidget.css'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

function AssistantWidget({ username }: { username: string }) {
  const [isOpen, setIsOpen] = useState(false)
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

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isSending])

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
            <div className="assistant-header-avatar" aria-hidden="true">🐣</div>
            <div className="assistant-header-copy">
              <h2>Mochi</h2>
              <p>Trợ lý của bạn</p>
            </div>
            <button
              className="assistant-close"
              type="button"
              onClick={() => setIsOpen(false)}
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
        className="assistant-mascot"
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={isOpen ? 'Đóng trò chuyện với Mochi' : 'Trò chuyện với Mochi'}
        aria-expanded={isOpen}
      >
        <span aria-hidden="true">🐣</span>
      </button>
    </div>
  )
}

export default AssistantWidget