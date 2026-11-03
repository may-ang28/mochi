import type { FormEvent } from 'react'
import MochiMascot from '../MochiMascot'

export type AuthMode = 'signup' | 'signin'

function LocalAuthScreen({
  authMode,
  authName,
  authPassword,
  allowPasswordManager,
  authBusy,
  authError,
  onAuthModeChange,
  onAuthNameChange,
  onAuthPasswordChange,
  onAllowPasswordManagerChange,
  onSubmit,
}: {
  authMode: AuthMode
  authName: string
  authPassword: string
  allowPasswordManager: boolean
  authBusy: boolean
  authError: string
  onAuthModeChange: (mode: AuthMode) => void
  onAuthNameChange: (name: string) => void
  onAuthPasswordChange: (password: string) => void
  onAllowPasswordManagerChange: (allow: boolean) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <main className="auth-screen">
      <section className="auth-card">
        <div className="auth-brand">
          <span className="auth-mascot"><MochiMascot /></span>
          <span>mochi</span>
        </div>
        <p className="auth-eyebrow">GÓC NHỎ CỦA RIÊNG BẠN</p>
        <h1>{authMode === 'signup' ? 'Bắt đầu từ tên của bạn' : 'Chào mừng bạn trở lại'}</h1>
        <p className="auth-description">
          {authMode === 'signup'
            ? 'Tạo hồ sơ để Mochi biết nên gọi bạn là gì.'
            : 'Nhập tên tài khoản và mật khẩu đã lưu trên thiết bị này.'}
        </p>

        <div className="auth-tabs" role="tablist" aria-label="Chọn đăng ký hoặc đăng nhập">
          <button
            type="button"
            role="tab"
            aria-selected={authMode === 'signup'}
            className={authMode === 'signup' ? 'active' : ''}
            onClick={() => onAuthModeChange('signup')}
          >
            Tạo tài khoản
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={authMode === 'signin'}
            className={authMode === 'signin' ? 'active' : ''}
            onClick={() => onAuthModeChange('signin')}
          >
            Đăng nhập
          </button>
        </div>

        <form className="auth-form" onSubmit={onSubmit}>
          <label>
            {authMode === 'signup' ? 'Tên bạn muốn Mochi gọi' : 'Tên tài khoản'}
            <input
              autoComplete={authMode === 'signup' ? 'nickname' : allowPasswordManager ? 'username' : 'off'}
              autoFocus={authMode === 'signup'}
              maxLength={30}
              minLength={2}
              required
              value={authName}
              onChange={(event) => onAuthNameChange(event.target.value)}
              placeholder="Ví dụ: Linh"
            />
          </label>
          <label>
            Mật khẩu
            <input
              autoComplete={authMode === 'signup' ? 'new-password' : allowPasswordManager ? 'current-password' : 'off'}
              autoFocus={authMode === 'signin'}
              maxLength={128}
              minLength={authMode === 'signup' ? 8 : undefined}
              required
              type="password"
              value={authPassword}
              onChange={(event) => onAuthPasswordChange(event.target.value)}
              placeholder={authMode === 'signup' ? 'Ít nhất 8 ký tự' : 'Nhập mật khẩu của bạn'}
            />
          </label>
          {authMode === 'signin' && (
            <label className="auth-remember-password">
              <input
                type="checkbox"
                checked={allowPasswordManager}
                onChange={(event) => onAllowPasswordManagerChange(event.target.checked)}
              />
              Cho phép trình duyệt đề xuất lưu mật khẩu
            </label>
          )}
          {authError && <p className="auth-error" role="alert">{authError}</p>}
          <button className="auth-submit" type="submit" disabled={authBusy}>
            {authBusy ? 'Đang xử lý...' : authMode === 'signup' ? 'Tạo hồ sơ & vào Mochi' : 'Đăng nhập'}
          </button>
        </form>
        <p className="auth-local-note">Có thể tạo nhiều tài khoản trên thiết bị này. Hồ sơ chỉ lưu trong trình duyệt này.</p>
      </section>
    </main>
  )
}

export default LocalAuthScreen
