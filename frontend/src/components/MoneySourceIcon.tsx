function MoneySourceIcon({ sourceType }: { sourceType: string }) {
  const normalizedType = sourceType.toLocaleLowerCase('vi')
  const iconType = normalizedType.includes('tiền mặt') || normalizedType.includes('cash')
    ? 'cash'
    : normalizedType.includes('ngân hàng') || normalizedType.includes('tài khoản') || normalizedType.includes('bank')
      ? 'bank'
      : normalizedType.includes('thẻ') || normalizedType.includes('card')
        ? 'card'
        : normalizedType.includes('ví') || normalizedType.includes('wallet')
          ? 'wallet'
          : 'other'

  return (
    <svg className={`source-bubble-icon source-bubble-icon-${iconType}`} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      {iconType === 'cash' ? (
        <>
          <rect x="5" y="12" width="38" height="25" rx="5" />
          <circle cx="24" cy="24.5" r="6" />
          <path d="M10 18c3 0 5-2 5-4M38 31c-3 0-5 2-5 4" />
        </>
      ) : iconType === 'bank' ? (
        <>
          <path d="m5 17 19-11 19 11v3H5z" />
          <path d="M9 22h30M7 39h34M11 24v12m9-12v12m8-12v12m9-12v12" />
        </>
      ) : iconType === 'card' ? (
        <>
          <rect x="5" y="10" width="38" height="28" rx="6" />
          <path d="M6 19h36" />
          <rect x="11" y="27" width="10" height="4" rx="2" />
        </>
      ) : iconType === 'wallet' ? (
        <>
          <path d="M8 13h29a4 4 0 0 1 4 4v20H10a5 5 0 0 1-5-5V16a3 3 0 0 1 3-3Z" />
          <path d="M7 13V9a3 3 0 0 1 3-3h25v7m-1 9h8v8h-8a4 4 0 0 1 0-8Z" />
          <circle cx="34" cy="26" r="1" />
        </>
      ) : (
        <>
          <circle cx="24" cy="24" r="17" />
          <path d="M28 17c-1-2-3-3-5-3-3 0-5 2-5 4 0 7 12 3 12 10 0 3-3 6-7 6-3 0-6-2-7-4m8-19v24" />
        </>
      )}
    </svg>
  )
}

export default MoneySourceIcon
