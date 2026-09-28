import { useEffect, useState } from 'react'
import {
  db,
  type Transaction,
  type Budget,
  type Goal,
  type Task,
} from './db'
  function App() {

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [type, setType] = useState<'income' | 'expense'>('expense')
  
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(
  new Date().toISOString().split('T')[0]
)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [budgetCategory, setBudgetCategory] = useState('')
const [budgetLimit, setBudgetLimit] = useState('')
const [budgetMonth, setBudgetMonth] = useState(
  new Date().toISOString().slice(0, 7)
)
const [budgets, setBudgets] = useState<Budget[]>([])
const [goals, setGoals] = useState<Goal[]>([])
const [tasks, setTasks] = useState<Task[]>([])
const [goalName, setGoalName] = useState('')
const [goalTargetAmount, setGoalTargetAmount] = useState('')
const [goalSavedAmount, setGoalSavedAmount] = useState('')
const [goalDeadline, setGoalDeadline] = useState('')
const [savingGoalId, setSavingGoalId] = useState<number | null>(null)
const [editingGoalId, setEditingGoalId] = useState<number | null>(null)
const [savingAmount, setSavingAmount] = useState('')
const [totalSaved, setTotalSaved] = useState(0)
const [editingBudgetId, setEditingBudgetId] = useState<number | null>(null)
const addTransaction = async () => {
  if (!amount || !category) {
    return
  }

  await db.transactions.add({
    type,
    amount: Number(amount),
    category,
    note,
    date,  })

  const allTransactions = await db.transactions.toArray()
  setTransactions(allTransactions)

  setAmount('')
  setCategory('')
  setNote('')
  setDate(new Date().toISOString().split('T')[0])
}
const addGoal = async () => {
  if (!goalName || !goalTargetAmount || !goalDeadline) {
    return
  }

  await db.goals.add({
    name: goalName,
    targetAmount: Number(goalTargetAmount),
    savedAmount: Number(goalSavedAmount) || 0,
    deadline: goalDeadline,
  })

  const allGoals = await db.goals.toArray()
  const allTasks = await db.tasks.toArray()

  setGoals(allGoals)
  setTasks(allTasks)

  setGoalName('')
  setGoalTargetAmount('')
  setGoalSavedAmount('')
  setGoalDeadline('')
}

const addTask = async () => {
  await db.tasks.add({
    title: 'Ghi lại chi tiêu hôm nay',
    completed: false,
    reward: 10,
    date: new Date().toISOString().split('T')[0],
  })

  const allTasks = await db.tasks.toArray()
  setTasks(allTasks)
}

const completeTask = async (id: number) => {
  await db.tasks.update(id, {
    completed: true,
  })

  const allTasks = await db.tasks.toArray()
  setTasks(allTasks)
}

const addSaving = async () => {
  if (savingGoalId === null || !savingAmount) {
    return
  }

  const goal = await db.goals.get(savingGoalId)

  if (!goal) {
    return
  }

  const amount = Number(savingAmount)

  // Cập nhật số tiền đã tiết kiệm của mục tiêu
  await db.goals.update(savingGoalId, {
    savedAmount: goal.savedAmount + amount,
  })

  // Tự động tạo giao dịch chi tiêu "Tiết kiệm"
  await db.transactions.add({
    type: 'expense',
    amount,
    category: 'Tiết kiệm',
    note: `Tiết kiệm cho mục tiêu: ${goal.name}`,
    date: new Date().toISOString().split('T')[0],
  })

  const allGoals = await db.goals.toArray()
  setGoals(allGoals)

  const allTransactions = await db.transactions.toArray()
  setTransactions(allTransactions)

  setSavingGoalId(null)
  setSavingAmount('')
}
const deleteGoal = async (id: number) => {
  await db.goals.delete(id)

  const allGoals = await db.goals.toArray()
  setGoals(allGoals)
}

const startEditingGoal = (goal: Goal) => {
  setEditingGoalId(goal.id ?? null)
  setGoalName(goal.name)
  setGoalTargetAmount(String(goal.targetAmount))
  setGoalDeadline(goal.deadline)
}

const updateGoal = async () => {
  if (
    editingGoalId === null ||
    !goalName ||
    !goalTargetAmount ||
    !goalDeadline
  ) {
    return
  }

  await db.goals.update(editingGoalId, {
    name: goalName,
    targetAmount: Number(goalTargetAmount),
    deadline: goalDeadline,
  })

  const allGoals = await db.goals.toArray()
  setGoals(allGoals)

  setEditingGoalId(null)
  setGoalName('')
  setGoalTargetAmount('')
  setGoalDeadline('')
}

const addBudget = async () => {
  if (!budgetCategory || !budgetLimit) {
    return
  }

  await db.budgets.add({
    category: budgetCategory,
    limit: Number(budgetLimit),
    month: budgetMonth,
  })

  setBudgetCategory('')
  setBudgetLimit('')
}
const updateBudget = async () => {
  if (editingBudgetId === null || !budgetCategory || !budgetLimit) {
    return
  }

  await db.budgets.update(editingBudgetId, {
    category: budgetCategory,
    limit: Number(budgetLimit),
    month: budgetMonth,
  })

  const allBudgets = await db.budgets.toArray()
  setBudgets(allBudgets)

  setEditingBudgetId(null)
  setBudgetCategory('')
  setBudgetLimit('')
}
const deleteBudget = async (id: number) => {
  await db.budgets.delete(id)

  const allBudgets = await db.budgets.toArray()
  setBudgets(allBudgets)
}
const startEditingBudget = (budget: Budget) => {
  setEditingBudgetId(budget.id ?? null)
  setBudgetCategory(budget.category)
  setBudgetLimit(String(budget.limit))
  setBudgetMonth(budget.month)
}
const getSpentForCategory = (category: string, month: string) => {
  return transactions
    .filter(
      (transaction) =>
        transaction.type === 'expense' &&
        transaction.category === category &&
        transaction.date.startsWith(month)
    )
    .reduce((sum, transaction) => sum + transaction.amount, 0)
}
const getBudgetPercentage = (budget: Budget) => {
const spent = getSpentForCategory(budget.category, budget.month)
  if (budget.limit === 0) {
    return 0
  }

  return Math.min((spent / budget.limit) * 100, 100)
}

const totalIncome = transactions
  .filter((transaction) => transaction.type === 'income')
  .reduce((sum, transaction) => sum + transaction.amount, 0)

const totalExpense = transactions
.filter((transaction) => transaction.type === 'expense')
.reduce((sum, transaction) => sum + transaction.amount, 0)

const balance = totalIncome - totalExpense

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
    date,
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
  setDate(transaction.date)
}

useEffect(() => {
  const loadData = async () => {
    const allTransactions = await db.transactions.toArray()
    const allBudgets = await db.budgets.toArray()
    const allGoals = await db.goals.toArray()

    setTransactions(allTransactions)
    setBudgets(allBudgets)
    setGoals(allGoals)
const savedTotal = allGoals.reduce(
  (sum, goal) => sum + goal.savedAmount,
  0
)

setTotalSaved(savedTotal)
  }

  loadData()
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
    Ngân sách
  </h2>

  <div className="mt-4 grid gap-4">
    <input
      type="text"
      placeholder="Danh mục, ví dụ: Ăn uống"
      value={budgetCategory}
      onChange={(e) => setBudgetCategory(e.target.value)}
      className="rounded-xl border p-3"
    />

    <input
      type="number"
      min="0"
      placeholder="Giới hạn chi tiêu"
      value={budgetLimit}
      onChange={(e) => setBudgetLimit(e.target.value)}
      className="rounded-xl border p-3"
    />

    <input
      type="month"
      value={budgetMonth}
      onChange={(e) => setBudgetMonth(e.target.value)}
      className="rounded-xl border p-3"
    />

    <button
  onClick={editingBudgetId !== null ? updateBudget : addBudget}
  className="rounded-xl bg-pink-500 p-3 font-bold text-white"
>
  {editingBudgetId !== null ? '💾 Lưu thay đổi' : '+ Thêm ngân sách'}
</button>
  </div>
</div>
{budgets.map((budget) => (
  <div
    key={budget.id}
    className="mt-4 rounded-xl bg-white p-4 shadow"
  >
    <p className="font-bold">
      {budget.category}
    </p>

    <p className="text-gray-600">
      Giới hạn: {budget.limit.toLocaleString('vi-VN')}đ
    </p>
    <p className="text-gray-600">
  Đã tiêu: {getSpentForCategory(budget.category).toLocaleString('vi-VN')}đ
</p>

    <p className="text-gray-500">
      Tháng: {budget.month}
    </p>
    <div className="mt-3">
  <div className="h-3 w-full rounded-full bg-gray-200">
    <div
className={`h-3 rounded-full ${
  getBudgetPercentage(budget) > 100
    ? 'bg-red-500'
    : getBudgetPercentage(budget) >= 80
      ? 'bg-orange-400'
      : 'bg-pink-400'
}`}      style={{
  width: `${Math.min(getBudgetPercentage(budget), 100)}%`,
}}
    />
  </div>

  <p className="mt-1 text-sm text-gray-500">
    {Math.round(getBudgetPercentage(budget))}% đã sử dụng
  </p>
  {getSpentForCategory(budget.category, budget.month) > budget.limit && (
  <p className="mt-2 font-bold text-red-500">
    Đã vượt ngân sách{' '}
    {(
      getSpentForCategory(budget.category, budget.month) - budget.limit
    ).toLocaleString('vi-VN')}
    đ
  </p>
)}
</div>
<button
  onClick={() => startEditingBudget(budget)}
  className="mt-3 mr-2 rounded-lg bg-blue-100 px-3 py-2 text-sm text-blue-600"
>
  ✏️ Sửa
</button>
    <button
  onClick={() => {
    if (budget.id !== undefined) {
      deleteBudget(budget.id)
    }
  }}
  className="mt-3 rounded-lg bg-red-100 px-3 py-2 text-sm text-red-600"
>
  🗑️ Xóa
</button>
  </div>
))}
<section className="mt-8">
  <h2 className="text-xl font-bold">🎯 Mục tiêu tiết kiệm</h2>

  {goals.length === 0 ? (
    <p className="mt-3 text-gray-500">
      Chưa có mục tiêu nào.
    </p>
  ) : (
    goals.map((goal) => (
      <div
        key={goal.id}
        className="mt-4 rounded-xl bg-white p-4 shadow"
      >
        <p className="font-bold">
          {goal.name}
        </p>

        <p className="text-gray-600">
          Đã tiết kiệm:{' '}
          {goal.savedAmount.toLocaleString('vi-VN')}đ
        </p>

        <p className="text-gray-600">
          Mục tiêu:{' '}
          {goal.targetAmount.toLocaleString('vi-VN')}đ
        </p>

        <p className="text-gray-500">
          Hạn: {goal.deadline}
        </p>
        {savingGoalId === goal.id && (
  <div className="mt-4 flex gap-2">
    <input
      type="number"
      min="0"
      placeholder="Số tiền muốn thêm"
      value={savingAmount}
      onChange={(e) => setSavingAmount(e.target.value)}
      className="flex-1 rounded-xl border p-3"
    />

    <button
      onClick={addSaving}
      className="rounded-xl bg-pink-500 px-4 font-bold text-white"
    >
      Lưu
    </button>
  </div>
)}

<button
  onClick={() => startEditingGoal(goal)}
  className="mt-3 mr-2 rounded-xl bg-blue-100 px-4 py-2 font-bold text-blue-500"
>
  ✏️ Sửa mục tiêu
</button>

<button
  onClick={() => {
    if (goal.id !== undefined) {
      deleteGoal(goal.id)
    }
  }}
  className="mt-3 rounded-xl bg-red-100 px-4 py-2 font-bold text-red-500"
>
  🗑️ Xóa mục tiêu
</button>
<button
  onClick={() => setSavingGoalId(goal.id ?? null)}
  className="mt-4 rounded-xl bg-pink-100 px-4 py-2 font-bold text-pink-600"
>
  + Thêm tiền
</button>
        <div className="mt-3">
  <div className="mb-1 flex justify-between text-sm">
    <span>Tiến độ</span>
    <span>
      {Math.min(
        (goal.savedAmount / goal.targetAmount) * 100,
        100
      ).toFixed(0)}%
    </span>
  </div>

  <div className="h-3 rounded-full bg-pink-100">
    <div
      className="h-3 rounded-full bg-pink-400"
      style={{
        width: `${Math.min(
          (goal.savedAmount / goal.targetAmount) * 100,
          100
        )}%`,
      }}
    />
  </div>
</div>
      </div>
    ))
  )}

  <section className="mt-8">
  <h2 className="text-xl font-bold">
    📝 Nhiệm vụ hôm nay
  </h2>

  {tasks.length === 0 ? (
    <p className="mt-3 text-gray-500">
      Chưa có nhiệm vụ nào.
    </p>
  ) : (
    <div className="mt-4 space-y-3">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="rounded-xl bg-white p-4 shadow"
        >
          <p className="font-bold">
            {task.title}
          </p>

          <p className="text-sm text-pink-500">
            🎁 +{task.reward} điểm
          </p>

          {!task.completed && (
  <button
    onClick={() => {
      if (task.id !== undefined) {
        completeTask(task.id)
      }
    }}
    className="mt-3 rounded-xl bg-pink-500 px-4 py-2 font-bold text-white"
  >
    ✅ Hoàn thành
  </button>
)}

{task.completed && (
  <p className="mt-3 font-bold text-green-500">
    🎉 Đã hoàn thành!
  </p>
)}
        </div>
      ))}
    </div>
  )}

  <button
    onClick={addTask}
    className="mt-4 rounded-xl bg-pink-500 px-4 py-3 font-bold text-white"
  >
    + Tạo nhiệm vụ
  </button>
</section>
  
</section>
<div className="mt-4 rounded-2xl bg-white p-6 shadow">
  <h2 className="text-2xl font-bold">
    Thêm mục tiêu
  </h2>

  <div className="mt-4 grid gap-4">
    <input
      type="text"
      placeholder="Tên mục tiêu, ví dụ: Mua tai nghe"
      value={goalName}
      onChange={(e) => setGoalName(e.target.value)}
      className="rounded-xl border p-3"
    />

    <input
      type="number"
      min="0"
      placeholder="Số tiền mục tiêu"
      value={goalTargetAmount}
      onChange={(e) => setGoalTargetAmount(e.target.value)}
      className="rounded-xl border p-3"
    />

    <input
      type="number"
      min="0"
      placeholder="Đã tiết kiệm bao nhiêu?"
      value={goalSavedAmount}
      onChange={(e) => setGoalSavedAmount(e.target.value)}
      className="rounded-xl border p-3"
    />

    <input
      type="date"
      value={goalDeadline}
      onChange={(e) => setGoalDeadline(e.target.value)}
      className="rounded-xl border p-3"
    />

    <button
  onClick={editingGoalId !== null ? updateGoal : addGoal}
  className="rounded-xl bg-pink-500 p-3 font-bold text-white"
>
  {editingGoalId !== null
    ? '💾 Cập nhật mục tiêu'
    : '+ Thêm mục tiêu'}
</button>
  </div>
</div>
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
    <input
  type="date"
  value={date}
  onChange={(e) => setDate(e.target.value)}
  className="rounded-xl border p-3"
/>

    <button
      onClick={editingId !== null ? updateTransaction : addTransaction}
      className="rounded-xl bg-pink-500 p-3 font-bold text-white"
    >
      {editingId !== null ? '💾 Lưu thay đổi' : '+ Thêm giao dịch'}
    </button>

    {editingId !== null && (
  <button
    onClick={() => {
      setEditingId(null)
      setAmount('')
      setCategory('')
      setNote('')
    }}
    className="rounded-xl bg-gray-100 p-3 font-bold text-gray-600"
  >
    Hủy sửa
  </button>
)}
  </div>
</div>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
  <div className="rounded-2xl bg-white p-5 shadow">
    <p className="text-sm text-gray-500">
      Tổng thu nhập
    </p>
    <p className="mt-2 text-2xl font-bold text-green-500">
      +{totalIncome.toLocaleString('vi-VN')}đ
    </p>
  </div>

  <div className="rounded-2xl bg-white p-5 shadow">
    <p className="text-sm text-gray-500">
      Tổng chi tiêu
    </p>
    <p className="mt-2 text-2xl font-bold text-red-500">
      -{totalExpense.toLocaleString('vi-VN')}đ
    </p>
  </div>

  <div className="rounded-2xl bg-white p-5 shadow">
    <p className="text-sm text-gray-500">
      Số dư
    </p>
    <p className="mt-2 text-2xl font-bold text-pink-500">
      {balance.toLocaleString('vi-VN')}đ
    </p>
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

            <p
          className={
            transaction.type === 'income'
      ? 'text-green-500'
      : 'text-red-500'
  }
>
  {transaction.type === 'income' ? '+' : '-'}
  {transaction.amount.toLocaleString('vi-VN')}đ
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