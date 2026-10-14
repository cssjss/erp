import { useState } from 'react'
import { readAvatarFromInput } from '../utils/avatar'
import type { UserAccount, UserPayload } from '../types'
import { Modal } from './Modal'
import {
  ResizableColGroup,
  ResizableTableHeader,
} from './ResizableTable'
import { useResizableColumns } from './useResizableColumns'
import type { ResizableColumnDefinition } from './useResizableColumns'

interface UserManagerProps {
  users: UserAccount[]
  currentUser: UserAccount
  loading: boolean
  onCreateUser: (payload: UserPayload) => Promise<void>
  onResetPassword: (userId: number, password: string) => Promise<void>
  onUpdateNote: (userId: number, note: string) => Promise<void>
  onDeleteUser: (userId: number) => Promise<void>
}

const USER_TABLE_COLUMNS: ResizableColumnDefinition[] = [
  { key: 'avatar', defaultWidth: 80, minWidth: 72, maxWidth: 120 },
  { key: 'username', defaultWidth: 140, minWidth: 100 },
  { key: 'email', defaultWidth: 240, minWidth: 150 },
  { key: 'created-at', defaultWidth: 140, minWidth: 110 },
  { key: 'reset-password', defaultWidth: 250, minWidth: 210 },
  { key: 'actions', defaultWidth: 150, minWidth: 130 },
  { key: 'note', defaultWidth: 220, minWidth: 120 },
]

function buildEmptyForm() {
  return {
    username: '',
    email: '',
    password: '',
    avatarDataUrl: '',
    note: '',
  }
}

export function UserManager({
  users,
  currentUser,
  loading,
  onCreateUser,
  onResetPassword,
  onUpdateNote,
  onDeleteUser,
}: UserManagerProps) {
  const [formState, setFormState] = useState<UserPayload>(buildEmptyForm())
  const [resetPasswordByUserId, setResetPasswordByUserId] = useState<Record<number, string>>({})
  const [localError, setLocalError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [noteModalUser, setNoteModalUser] = useState<UserAccount | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const tableResize = useResizableColumns('erp-table-widths:users', USER_TABLE_COLUMNS)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLocalError('')
    await onCreateUser({
      username: formState.username.trim(),
      email: formState.email.trim(),
      password: formState.password,
      avatarDataUrl: formState.avatarDataUrl,
      note: formState.note?.trim() || '',
    })
    setFormState(buildEmptyForm())
    setModalOpen(false)
  }

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    try {
      setLocalError('')
      const avatarDataUrl = await readAvatarFromInput(event.target.files?.[0])
      setFormState((current) => ({ ...current, avatarDataUrl }))
    } catch (avatarError: any) {
      setLocalError(avatarError?.message || '头像上传失败。')
    } finally {
      event.target.value = ''
    }
  }

  function openCreateModal() {
    setLocalError('')
    setFormState(buildEmptyForm())
    setModalOpen(true)
  }

  async function handleResetPassword(userId: number) {
    const password = resetPasswordByUserId[userId] || ''

    if (!password) {
      setLocalError('请输入新密码。')
      return
    }

    setLocalError('')
    await onResetPassword(userId, password)
    setResetPasswordByUserId((current) => ({ ...current, [userId]: '' }))
  }

  async function handleDeleteUser(user: UserAccount) {
    const confirmed = window.confirm(`确认删除用户“${user.username}”吗？`)

    if (!confirmed) {
      return
    }

    await onDeleteUser(user.id)
  }

  function openNoteModal(user: UserAccount) {
    setNoteModalUser(user)
    setNoteDraft(user.note || '')
  }

  async function handleNoteSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!noteModalUser) {
      return
    }

    await onUpdateNote(noteModalUser.id, noteDraft.trim())
    setNoteModalUser(null)
    setNoteDraft('')
  }

  const visibleUsers = users.filter((user) => {
    const keyword = searchKeyword.trim().toLowerCase()
    return (
      !keyword ||
      user.username.toLowerCase().includes(keyword) ||
      user.email.toLowerCase().includes(keyword) ||
      (user.note || '').toLowerCase().includes(keyword)
    )
  })

  return (
    <div className="content-stack">
      <section className="panel">
        <div className="panel__header product-list-header">
          <div>
            <h2>用户数据表</h2>
            <p>当前登录用户：{currentUser.username}</p>
          </div>
          <button className="primary-button" type="button" onClick={openCreateModal}>新增用户</button>
        </div>

        {localError ? <div className="error-banner error-banner--inline">{localError}</div> : null}

        <div className="table-filters table-search-only">
          <label className="table-search">
            <span>筛选</span>
            <input value={searchKeyword} onChange={(event) => setSearchKeyword(event.target.value)} placeholder="用户名、邮箱或备注" />
          </label>
        </div>

        <div className="table-wrap">
          <table className="erp-table erp-table--resizable" style={tableResize.tableStyle}>
            <ResizableColGroup resize={tableResize} />
            <thead>
              <tr>
                <ResizableTableHeader columnKey="avatar" label="头像" resize={tableResize} />
                <ResizableTableHeader columnKey="username" label="用户名" resize={tableResize} />
                <ResizableTableHeader columnKey="email" label="邮箱" resize={tableResize} />
                <ResizableTableHeader columnKey="created-at" label="创建时间" resize={tableResize} />
                <ResizableTableHeader columnKey="reset-password" label="重置密码" resize={tableResize} />
                <ResizableTableHeader columnKey="actions" label="操作" resize={tableResize} />
                <ResizableTableHeader columnKey="note" label="备注" resize={tableResize} />
              </tr>
            </thead>
            <tbody>
              {visibleUsers.length === 0 ? (
                <tr>
                  <td className="table-empty" colSpan={7}>
                    暂无用户数据。
                  </td>
                </tr>
              ) : (
                visibleUsers.map((user) => (
                  <tr key={user.id}>
                    <td data-label="头像">
                      <div className="user-avatar">
                        {user.avatarDataUrl ? <img src={user.avatarDataUrl} alt={user.username} /> : user.username.slice(0, 1)}
                      </div>
                    </td>
                    <td data-label="用户名">{user.username}</td>
                    <td data-label="邮箱">{user.email}</td>
                    <td data-label="创建时间">{user.createdAt ? String(user.createdAt).slice(0, 10) : '-'}</td>
                    <td data-label="重置密码">
                      <div className="inline-field inline-field--row">
                        <input
                          type="password"
                          value={resetPasswordByUserId[user.id] || ''}
                          onChange={(event) =>
                            setResetPasswordByUserId((current) => ({
                              ...current,
                              [user.id]: event.target.value,
                            }))
                          }
                          placeholder="新密码"
                        />
                        <button
                          className="ghost-button"
                          type="button"
                          disabled={loading}
                          onClick={() => void handleResetPassword(user.id)}
                        >
                          重置
                        </button>
                      </div>
                    </td>
                    <td data-label="操作">
                      <div className="row-actions">
                        <button
                          className="text-action text-action--edit"
                          type="button"
                          disabled={loading}
                          onClick={() => openNoteModal(user)}
                        >
                          编辑备注
                        </button>
                        <button
                          className="text-action text-action--delete"
                          type="button"
                          disabled={loading}
                          onClick={() => void handleDeleteUser(user)}
                        >
                          删除
                        </button>
                      </div>
                    </td>
                    <td data-label="备注">{user.note || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={modalOpen}
        title="新增用户"
        description="填写登录信息后创建用户。"
        busy={loading}
        onClose={() => setModalOpen(false)}
      >
        {localError ? <div className="error-banner error-banner--inline">{localError}</div> : null}
        <form className="user-form modal-form" onSubmit={handleSubmit}>
          <div className="dynamic-fields">
            <label className="field"><span>用户名</span><input value={formState.username} onChange={(event) => setFormState((current) => ({ ...current, username: event.target.value }))} placeholder="请输入用户名" /></label>
            <label className="field"><span>邮箱</span><input type="email" value={formState.email} onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))} placeholder="请输入邮箱" /></label>
            <label className="field"><span>初始密码</span><input type="password" value={formState.password} onChange={(event) => setFormState((current) => ({ ...current, password: event.target.value }))} placeholder="至少 6 位" /></label>
            <label className="field"><span>头像</span><input type="file" accept="image/*" onChange={handleAvatarChange} /></label>
            <label className="field field--wide"><span>备注</span><input maxLength={255} value={formState.note || ''} onChange={(event) => setFormState((current) => ({ ...current, note: event.target.value }))} placeholder="可填写用户说明" /></label>
          </div>
          {formState.avatarDataUrl ? <img className="avatar-preview" src={formState.avatarDataUrl} alt="头像预览" /> : null}
          <div className="modal-form__actions">
            <button className="ghost-button" type="button" onClick={() => setModalOpen(false)} disabled={loading}>取消</button>
            <button className="primary-button" type="submit" disabled={loading}>{loading ? '保存中...' : '保存用户'}</button>
          </div>
        </form>
      </Modal>

      <Modal
        open={noteModalUser !== null}
        title="编辑用户备注"
        description={noteModalUser ? `用户：${noteModalUser.username}` : undefined}
        busy={loading}
        onClose={() => setNoteModalUser(null)}
      >
        <form className="modal-form" onSubmit={handleNoteSubmit}>
          <label className="field field--wide">
            <span>备注</span>
            <input
              maxLength={255}
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              placeholder="可填写用户说明"
            />
          </label>
          <div className="modal-form__actions">
            <button className="ghost-button" type="button" onClick={() => setNoteModalUser(null)} disabled={loading}>取消</button>
            <button className="primary-button" type="submit" disabled={loading}>{loading ? '保存中...' : '保存备注'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
