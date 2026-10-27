const ACCOUNT_STORAGE_KEY = 'mochi-local-accounts'
const SESSION_STORAGE_KEY = 'mochi-local-session'
const PBKDF2_ITERATIONS = 210_000

export type LocalAccount = {
  username: string
  storageKey: string
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

const parseLocalAccount = (value: unknown, legacy = false): LocalAccount => {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('username' in value) ||
    !('salt' in value) ||
    !('passwordHash' in value) ||
    typeof value.username !== 'string' ||
    typeof value.salt !== 'string' ||
    typeof value.passwordHash !== 'string' ||
    ('storageKey' in value && typeof value.storageKey !== 'string')
  ) {
    throw new Error('Hồ sơ đã lưu không hợp lệ. Hãy xóa dữ liệu Mochi của trang rồi tạo tài khoản mới.')
  }

  return {
    username: value.username,
    storageKey: 'storageKey' in value && typeof value.storageKey === 'string'
      ? value.storageKey
      : legacy ? 'legacy' : `account-${value.username.trim().toLocaleLowerCase('vi-VN')}`,
    salt: value.salt,
    passwordHash: value.passwordHash,
  }
}

export const getLocalAccounts = (): LocalAccount[] => {
  const stored = localStorage.getItem(ACCOUNT_STORAGE_KEY)
  if (!stored) {
    const legacyStored = localStorage.getItem('mochi-local-account')
    if (!legacyStored) return []
    try {
      return [parseLocalAccount(JSON.parse(legacyStored), true)]
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('Không đọc được hồ sơ đã lưu trên thiết bị này.', { cause: error })
      }
      throw error
    }
  }

  let accounts: unknown
  try {
    accounts = JSON.parse(stored)
  } catch {
    throw new Error('Không đọc được danh sách hồ sơ đã lưu trên thiết bị này.')
  }

  if (!Array.isArray(accounts)) {
    throw new Error('Danh sách hồ sơ đã lưu không hợp lệ. Hãy xóa dữ liệu Mochi của trang rồi tạo tài khoản mới.')
  }

  return accounts.map((account) => parseLocalAccount(account))
}

export const getSignedInUsername = () => localStorage.getItem(SESSION_STORAGE_KEY)

export const getSignedInAccountStorageKey = () => {
  const username = getSignedInUsername()
  if (!username) return null
  const normalizedUsername = username.trim().toLocaleLowerCase('vi-VN')
  return getLocalAccounts().find(
    (account) => account.username.trim().toLocaleLowerCase('vi-VN') === normalizedUsername,
  )?.storageKey ?? null
}

export const createLocalAccount = async (username: string, password: string) => {
  const accounts = getLocalAccounts()
  const normalizedUsername = username.trim().toLocaleLowerCase('vi-VN')
  if (accounts.some((account) => account.username.trim().toLocaleLowerCase('vi-VN') === normalizedUsername)) {
    throw new Error('Tên tài khoản này đã được tạo trên thiết bị. Hãy đăng nhập hoặc chọn tên khác.')
  }
  if (!crypto.subtle) {
    throw new Error('Trình duyệt cần HTTPS hoặc localhost để tạo hồ sơ an toàn.')
  }

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const account: LocalAccount = {
    username,
    storageKey: `account-${normalizedUsername}`,
    salt: encodeBase64(salt),
    passwordHash: await hashPassword(password, salt),
  }

  localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify([...accounts, account]))
  localStorage.removeItem('mochi-local-account')
  localStorage.setItem(SESSION_STORAGE_KEY, username)
}

export const verifyLocalAccountPassword = async (username: string, password: string) => {
  const normalizedUsername = username.trim().toLocaleLowerCase('vi-VN')
  const account = getLocalAccounts().find(
    (savedAccount) => savedAccount.username.trim().toLocaleLowerCase('vi-VN') === normalizedUsername,
  )
  if (!account) {
    throw new Error('Tên tài khoản hoặc mật khẩu chưa chính xác.')
  }
  if (!crypto.subtle) {
    throw new Error('Trình duyệt cần HTTPS hoặc localhost để đăng nhập an toàn.')
  }

  const passwordHash = await hashPassword(password, decodeBase64(account.salt))
  if (passwordHash !== account.passwordHash) {
    throw new Error('Tên tài khoản hoặc mật khẩu chưa chính xác.')
  }

  return account.username
}

export const signInLocalAccount = async (username: string, password: string) => {
  const verifiedUsername = await verifyLocalAccountPassword(username, password)
  localStorage.setItem(SESSION_STORAGE_KEY, verifiedUsername)
  return verifiedUsername
}

export const signOutLocalAccount = () => {
  localStorage.removeItem(SESSION_STORAGE_KEY)
}
