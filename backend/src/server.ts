import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'

const app = express()
const PORT = Number(process.env.PORT || 3000)
const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
)

app.use(cors({
  origin(origin, callback) {
    callback(null, !origin || allowedOrigins.has(origin))
  },
}))

app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' },
}))

app.use(express.json({ limit: '64kb' }))

app.get('/', (_request, response) => {
  response.json({ message: 'Mochi backend is running.' })
})

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', message: 'Mochi API is working.' })
})

app.post('/api/chat', (_request, response) => {
  return response.status(503).json({
    error: 'Endpoint trò chuyện tạm thời bị vô hiệu hóa cho đến khi có xác thực.',
  })
})

app.listen(PORT, () => {
  console.log(`Mochi backend listening on port ${PORT}`)
})
