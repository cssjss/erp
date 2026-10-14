import { useEffect } from 'react'

interface ModalProps {
  open: boolean
  title: string
  description?: string
  busy?: boolean
  onClose: () => void
  children: React.ReactNode
}

export function Modal({ open, title, description, busy = false, onClose, children }: ModalProps) {
  useEffect(() => {
    if (!open) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [busy, onClose, open])

  if (!open) {
    return null
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) {
        onClose()
      }
    }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal__header">
          <div>
            <h2 id="modal-title">{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <button className="modal__close" type="button" onClick={onClose} disabled={busy} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </section>
    </div>
  )
}
