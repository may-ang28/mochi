import { useEffect, useState } from 'react'

type DateParts = {
  day: string
  month: string
  year: string
}

type DatePickerProps = {
  value: string
  onChange: (value: string) => void
  required?: boolean
  monthOnly?: boolean
}

const parseDateParts = (value: string): DateParts => {
  const [year = '', month = '', day = ''] = value.split('-')
  return { day, month, year }
}

function DatePicker({ value, onChange, required = false, monthOnly = false }: DatePickerProps) {
  const [parts, setParts] = useState(() => parseDateParts(value))
  const currentYear = new Date().getFullYear()
  const selectedYear = Number(parts.year)
  const firstYear = Math.min(currentYear - 100, selectedYear || currentYear - 100)
  const lastYear = Math.max(currentYear + 30, selectedYear || currentYear + 30)
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => String(lastYear - index))
  const dayCount = parts.month
    ? new Date(selectedYear || currentYear, Number(parts.month), 0).getDate()
    : 31

  useEffect(() => {
    setParts(parseDateParts(value))
  }, [value])

  const updatePart = (part: keyof DateParts, nextValue: string) => {
    const nextParts = { ...parts, [part]: nextValue }
    if (!monthOnly && part !== 'day' && nextParts.day && nextParts.month) {
      const year = Number(nextParts.year) || currentYear
      const maxDay = new Date(year, Number(nextParts.month), 0).getDate()
      nextParts.day = String(Math.min(Number(nextParts.day), maxDay)).padStart(2, '0')
    }

    setParts(nextParts)
    if (!nextParts.year || !nextParts.month || (!monthOnly && !nextParts.day)) {
      onChange('')
      return
    }

    const formattedMonth = nextParts.month.padStart(2, '0')
    onChange(monthOnly
      ? `${nextParts.year}-${formattedMonth}`
      : `${nextParts.year}-${formattedMonth}-${nextParts.day.padStart(2, '0')}`)
  }

  return (
    <div className={`date-picker-fields${monthOnly ? ' month-only' : ''}`} role="group" aria-label={monthOnly ? 'Chọn tháng và năm' : 'Chọn ngày tháng năm'}>
      {!monthOnly && (
        <select aria-label="Ngày" required={required} value={parts.day} onChange={(event) => updatePart('day', event.target.value)}>
          <option value="">Ngày</option>
          {Array.from({ length: dayCount }, (_, index) => {
            const day = String(index + 1).padStart(2, '0')
            return <option key={day} value={day}>{index + 1}</option>
          })}
        </select>
      )}
      <select aria-label="Tháng" required={required} value={parts.month} onChange={(event) => updatePart('month', event.target.value)}>
        <option value="">Tháng</option>
        {Array.from({ length: 12 }, (_, index) => {
          const month = String(index + 1).padStart(2, '0')
          return <option key={month} value={month}>{index + 1}</option>
        })}
      </select>
      <select aria-label="Năm" required={required} value={parts.year} onChange={(event) => updatePart('year', event.target.value)}>
        <option value="">Năm</option>
        {years.map((year) => <option key={year} value={year}>{year}</option>)}
      </select>
    </div>
  )
}

export default DatePicker
