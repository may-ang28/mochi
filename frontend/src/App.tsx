import { useEffect, useState } from 'react'
import { db, type Transaction } from './db'

function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [note, setNote] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const addTransaction = async () => {
  if (!amount || !category) {
    return
  }

  await db.transactions.add({
    type,
    amount: Number(amount),
    category,
    note,
    date: new Date().toISOString().split('T')[0],
  })

  const allTransactions = await db.transactions.toArray()
  setTransactions(allTransactions)

  setAmount('')
  setCategory('')
  setNote('')
}

const deleteTransaction = async (id: number) => {
  await db.transactions.delete(id)

  const allTransactions = await db.transactions.toArray()
  setTransactions(allTransactions)
}

const updateTransaction = async () => {
  if (editingId === null || !amount || !category) {
    return
  }

  await db.transactions.update(editingId, {
    type,
    amount: Number(amount),
    category,
    note,
  })

  const allTransactions = await db.transactions.toArray()
  setTransactions(allTransactions)

  setEditingId(null)
  setAmount('')
  setCategory('')
  setNote('')
}

const startEditing = (transaction: Transaction) => {
  setEditingId(transaction.id ?? null)
  setType(transaction.type)
  setAmount(String(transaction.amount))
  setCategory(transaction.category)
  setNote(transaction.note ?? '')
}

  useEffect(() => {
  const loadTransactions = async () => {
    const allTransactions = await db.transactions.toArray()
    setTransactions(allTransactions)
  }

  loadTransactions()
}, [])

  return (
    <div className="min-h-screen bg-pink-100 p-8">
      <h1 className="text-4xl font-bold text-pink-500">
        Mochi 🍡
      </h1>

      <p className="mt-2 text-gray-600">
        Database đang hoạt động!
      </p>

    <div className="mt-8 rounded-2xl bg-white p-6 shadow">
  <h2 className="text-2xl font-bold">
    Thêm giao dịch
  </h2>

  <div className="mt-4 grid gap-4">
    <select
      value={type}
      onChange={(e) =>
        setType(e.target.value as 'income' | 'expense')
      }
      className="rounded-xl border p-3"
    >
      <option value="expense">Chi tiêu</option>
      <option value="income">Thu nhập</option>
    </select>

    <input
      type="number"
      placeholder="Số tiền"
      min="0"
      value={amount}
      onChange={(e) => setAmount(e.target.value)}
      className="rounded-xl border p-3"
    />

    <input
      type="text"
      placeholder="Danh mục"
      value={category}
      onChange={(e) => setCategory(e.target.value)}
      className="rounded-xl border p-3"
    />

    <input
      type="text"
      placeholder="Ghi chú"
      value={note}
      onChange={(e) => setNote(e.target.value)}
      className="rounded-xl border p-3"
    />

    <button
      onClick={editingId !== null ? updateTransaction : addTransaction}
      className="rounded-xl bg-pink-500 p-3 font-bold text-white"
    >
      {editingId !== null ? '💾 Lưu thay đổi' : '+ Thêm giao dịch'}
    </button>
  </div>
</div>
      <div className="mt-8">
        <h2 className="text-2xl font-bold">
          Giao dịch
        </h2>

        {transactions.map((transaction) => (
          <div
            key={transaction.id}
            className="mt-4 rounded-xl bg-white p-4 shadow"
          >
            <p className="font-bold">
              {transaction.category}
            </p>

            <p className="text-red-500">
              -{transaction.amount.toLocaleString('vi-VN')}đ
            </p>

            <p className="text-gray-500">
              {transaction.note}
            </p>

            <button
              onClick={() => {
              if (transaction.id !== undefined) {
              deleteTransaction(transaction.id)
              }
            }}
            className="mt-3 rounded-lg bg-red-100 px-3 py-2 text-sm text-red-600"
            >
            🗑️ Xóa
            </button>

            <button
            onClick={() => startEditing(transaction)}
            className="mt-3 ml-2 rounded-lg bg-blue-100 px-3 py-2 text-sm text-blue-600"
            >
            ✏️ Sửa
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default App