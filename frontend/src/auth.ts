const ACCOUNT_STORAGE_KEY = 'mochi-local-account'
const SESSION_STORAGE_KEY = 'mochi-local-session'
const PBKDF2_ITERATIONS = 210_000

export type LocalAccount = {
  username: string
  salt: string
  passwordHash: string
}

const encodeBase64 = (bytes: Uint8Array) => {
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary)
}

const decodeBase64 = (value: string) =>
  Uint8Array.from(atob(value), (character) => character.charCodeAt(0))

const hashPassword = async (password: string, salt: Uint8Array) => {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const saltBuffer = new ArrayBuffer(salt.byteLength)
  new Uint8Array(saltBuffer).set(salt)
  const result = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBuffer, iterations: PBKDF2_ITERATIONS },
    key,
    256,
  )
  return encodeBase64(new Uint8Array(result))
}

export const getLocalAccount = (): LocalAccount | null => {
  const stored = localStorage.getItem(ACCOUNT_STORAGE_KEY)
  if (!stored) return null

  let account: unknown
  try {
    account = JSON.parse(stored)
  } catch {
    throw new Error('Không đọc được hồ sơ đã lưu trên thiết bị này.')
  }

  if (
    typeof account !== 'object' ||
    account === null ||
    !('username' in account) ||
    !('salt' in account) ||
    !('passwordHash' in account) ||
    typeof account.username !== 'string' ||
    typeof account.salt !== 'string' ||
    typeof account.passwordHash !== 'string'
  ) {
    throw new Error('Hồ sơ đã lưu không hợp lệ. Hãy xóa dữ liệu Mochi của trang rồi tạo tài khoản mới.')
  }

  return {
    username: account.username,
    salt: account.salt,
    passwordHash: account.passwordHash,
  }
}

export const getSignedInUsername = () => localStorage.getItem(SESSION_STORAGE_KEY)

export const createLocalAccount = async (username: string, password: string) => {
  if (getLocalAccount()) {
    throw new Error('Thiết bị này đã có hồ sơ Mochi. Hãy đăng nhập bằng hồ sơ hiện có.')
  }
  if (!crypto.subtle) {
    throw new Error('Trình duyệt cần HTTPS hoặc localhost để tạo hồ sơ an toàn.')
  }

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const account: LocalAccount = {
    username,
    salt: encodeBase64(salt),
    passwordHash: await hashPassword(password, salt),
  }

  localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(account))
  localStorage.setItem(SESSION_STORAGE_KEY, username)
}

export const signInLocalAccount = async (password: string) => {
  const account = getLocalAccount()
  if (!account) {
    throw new Error('Chưa có hồ sơ trên thiết bị này. Hãy tạo tài khoản trước.')
  }
  if (!crypto.subtle) {
    throw new Error('Trình duyệt cần HTTPS hoặc localhost để đăng nhập an toàn.')
  }

  const passwordHash = await hashPassword(password, decodeBase64(account.salt))
  if (passwordHash !== account.passwordHash) {
    throw new Error('Mật khẩu chưa chính xác. Hãy thử lại.')
  }

  localStorage.setItem(SESSION_STORAGE_KEY, account.username)
  return account.username
}

export const signOutLocalAccount = () => {
  localStorage.removeItem(SESSION_STORAGE_KEY)
}
