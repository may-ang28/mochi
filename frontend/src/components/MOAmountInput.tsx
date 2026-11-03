const formatIntegerInput = (value: string) => {
  const digits = value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 16)
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function MOAmountInput({
  value,
  onChange,
  placeholder = 'Nhập số MO',
  required = false,
  allowNegative = false,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  allowNegative?: boolean
}) {
  const isNegative = allowNegative && value.startsWith('-')
  const digits = value.replace(/\D/g, '')
  const numericValue = Number(digits)
  const suggestedValues = !isNegative && digits && numericValue > 0 && numericValue < 1000
    ? [`${digits}000`, `${digits}000000`]
    : []

  return (
    <span className="mo-amount-control">
      <input
        type="text"
        inputMode={allowNegative ? 'decimal' : 'numeric'}
        pattern={allowNegative ? '-?[0-9.]*' : '[0-9.]*'}
        autoComplete="off"
        maxLength={22}
        required={required}
        value={`${isNegative ? '-' : ''}${formatIntegerInput(value)}`}
        onChange={(event) => {
          const nextValue = event.target.value
          const negative = allowNegative && nextValue.trimStart().startsWith('-')
          const nextDigits = nextValue.replace(/\D/g, '').slice(0, 16)
          onChange(`${negative ? '-' : ''}${nextDigits}`)
        }}
        placeholder={placeholder}
      />
      <small className="mo-amount-unit">MO</small>
      {suggestedValues.map((suggestedValue) => (
        <button
          key={suggestedValue}
          className="mo-amount-suggestion"
          type="button"
          aria-label={`Dùng đề xuất ${formatIntegerInput(suggestedValue)} MO`}
          onClick={() => onChange(suggestedValue)}
        >
          {formatIntegerInput(suggestedValue)} MO · +{suggestedValue.endsWith('000000') ? '000000' : '000'}
        </button>
      ))}
    </span>
  )
}

export default MOAmountInput
