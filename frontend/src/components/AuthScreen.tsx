import { useState } from 'react'
import { readAvatarFromInput } from '../utils/avatar'
import type { UserPayload } from '../types'

interface AuthScreenProps {
  loading: boolean
  error: string
  onLogin: (payload: { account: string; password: string }) => Promise<void>
  onRegister: (payload: UserPayload) => Promise<void>
}

type AuthMode = 'login' | 'register'

export function AuthScreen({ loading, error, onLogin, onRegister }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [loginForm, setLoginForm] = useState({ account: '', password: '' })
  const [registerForm, setRegisterForm] = useState({
    username: '',
    email: '',
    password: '',
    avatarDataUrl: '',
  })
  const [localError, setLocalError] = useState('')

  async function handleLoginSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLocalError('')
    await onLogin({
      account: loginForm.account.trim(),
      password: loginForm.password,
    })
  }

  async function handleRegisterSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLocalError('')
    await onRegister({
      username: registerForm.username.trim(),
      email: registerForm.email.trim(),
      password: registerForm.password,
      avatarDataUrl: registerForm.avatarDataUrl,
    })
  }

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    try {
      setLocalError('')
      const avatarDataUrl = await readAvatarFromInput(event.target.files?.[0])
      setRegisterForm((current) => ({ ...current, avatarDataUrl }))
    } catch (avatarError: any) {
      setLocalError(avatarError?.message || '头像上传失败。')
    } finally {
      event.target.value = ''
    }
  }

  const displayError = localError || error

  return (
    <div className="auth-page">
      <section className="auth-panel">
        <div className="auth-panel__brand">
          <div className="topbar__logo">ERP</div>
          <div>
            <h1>退货售后ERP系统</h1>
            <p>请登录后继续使用系统功能。</p>
          </div>
        </div>

    
        <div className="auth-tabs">
          <button
            type="button"
            className={mode === 'login' ? 'is-active' : ''}
            onClick={() => setMode('login')}
          >
            登录
          </button>
          
        </div>

        {displayError ? <div className="error-banner error-banner--inline">{displayError}</div> : null}

        {mode === 'login' ? (
          <form className="auth-form" onSubmit={handleLoginSubmit}>
            <label className="field">
              <span>用户名或邮箱</span>
              <input
                value={loginForm.account}
                onChange={(event) => setLoginForm((current) => ({ ...current, account: event.target.value }))}
                placeholder="请输入用户名或邮箱"
              />
            </label>
            <label className="field">
              <span>密码</span>
              <input
                type="password"
                value={loginForm.password}
                onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                placeholder="请输入密码"
              />
            </label>
            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? '登录中...' : '登录'}
            </button>
          
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleRegisterSubmit}>
            <label className="field">
              <span>用户名</span>
              <input
                value={registerForm.username}
                onChange={(event) => setRegisterForm((current) => ({ ...current, username: event.target.value }))}
                placeholder="请输入用户名"
              />
            </label>
            <label className="field">
              <span>邮箱</span>
              <input
                type="email"
                value={registerForm.email}
                onChange={(event) => setRegisterForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="请输入邮箱"
              />
            </label>
            <label className="field">
              <span>密码</span>
              <input
                type="password"
                value={registerForm.password}
                onChange={(event) => setRegisterForm((current) => ({ ...current, password: event.target.value }))}
                placeholder="至少 6 位"
              />
            </label>
            <label className="field">
              <span>头像</span>
              <input type="file" accept="image/*" onChange={handleAvatarChange} />
            </label>
            {registerForm.avatarDataUrl ? (
              <img className="avatar-preview" src={registerForm.avatarDataUrl} alt="头像预览" />
            ) : null}
            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? '注册中...' : '注册并登录'}
            </button>
          </form>
        )}
      </section>
    </div>
  )
}
