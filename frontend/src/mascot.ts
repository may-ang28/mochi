export type MascotExpression = 'happy' | 'curious' | 'sleepy'

export const mascotExpressions: { id: MascotExpression; label: string; icon: string }[] = [
  { id: 'happy', label: 'Vui vẻ', icon: '☺' },
  { id: 'curious', label: 'Tò mò', icon: '◉' },
  { id: 'sleepy', label: 'Buồn ngủ', icon: 'ᵕ' },
]