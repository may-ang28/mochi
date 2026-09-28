import express from 'express'
import cors from 'cors'

const app = express()
const PORT = 3000

app.use(express.json())
app.use(cors())

app.get('/', (_req, res) => {
  res.json({
    message: 'Mochi Backend is running! 🍡',
  })
})

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'Mochi API is working! 🍡',
  })
})

app.listen(PORT, () => {
  console.log(`🍡 Mochi Backend running at http://localhost:${PORT}`)
})