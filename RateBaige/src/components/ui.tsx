/* ------------------------------------------------------------------
   VANTA — shared UI primitives.
   Card surfaces, buttons, dialogs, toasts, progress meters, toggles,
   skeletons and empty states. All consume the design tokens.
   ------------------------------------------------------------------ */

import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'
import type { AvatarId, IconName } from '../lib/types'
import { AVATAR_OPTIONS } from '../lib/appearance'
import { Icon } from './Icon'
import { useApp } from '../state/AppContext'

/* ---------- button ---------- */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'gold' | 'ghost' | 'outline' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  block?: boolean
  icon?: IconName
  loading?: boolean
  success?: boolean
}

export function Button({
  variant = 'outline',
  size = 'md',
  block,
  icon,
  loading,
  success,
  children,
  className,
  disabled,
  ...rest
}: ButtonProps) {
  const classes = [
    'btn',
    `btn--${variant}`,
    size !== 'md' ? `btn--${size}` : '',
    block ? 'btn--block' : '',
    loading ? 'is-loading' : '',
    success ? 'is-success' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <button className={classes} disabled={disabled || loading} {...rest}>
      {loading ? (
        <span className="btn__spinner" aria-hidden="true" />
      ) : success ? (
        <Icon name="check" size={16} />
      ) : icon ? (
        <Icon name={icon} size={16} />
      ) : null}
      {children && <span>{children}</span>}
    </button>
  )
}

/* ---------- panel ---------- */

export function Panel({
  children,
  className,
  as: As = 'section',
}: {
  children: ReactNode
  className?: string
  as?: 'section' | 'article' | 'div'
}) {
  return <As className={`panel ${className ?? ''}`}>{children}</As>
}

export function PanelHead({
  title,
  action,
  eyebrow,
  id,
}: {
  title?: string
  eyebrow?: string
  action?: ReactNode
  id?: string
}) {
  return (
    <div className="panel__head">
      <div>
        {eyebrow && <p className="eyebrow eyebrow--muted">{eyebrow}</p>}
        {title && (
          <h2 className="title-md" id={id}>
            {title}
          </h2>
        )}
      </div>
      {action}
    </div>
  )
}

/* ---------- progress ---------- */

export function ProgressBar({
  value,
  max = 1,
  tone = 'gold',
  label,
}: {
  value: number
  max?: number
  tone?: 'gold' | 'plain'
  label?: string
}) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  return (
    <div
      className={`meter meter--${tone}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label}
    >
      <span className="meter__fill" style={{ width: `${ratio * 100}%` }} />
    </div>
  )
}

/* ---------- stat tile ---------- */

export function Stat({
  label,
  value,
  unit,
  tone,
  hint,
}: {
  label: string
  value: ReactNode
  unit?: string
  tone?: 'gold' | 'red' | 'plain'
  hint?: string
}) {
  return (
    <div className="stat">
      <p className="stat__label">{label}</p>
      <p className={`stat__value num${tone ? ` is-${tone}` : ''}`}>
        {value}
        {unit && <span className="u">{unit}</span>}
      </p>
      {hint && <p className="stat__hint">{hint}</p>}
    </div>
  )
}

/* ---------- toggle ---------- */

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  icon,
  disabled,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  hint?: string
  icon?: IconName
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`toggle-row${disabled ? ' is-disabled' : ''}`}
      onClick={() => onChange(!checked)}
    >
      {icon && (
        <span className="toggle-row__icon" aria-hidden="true">
          <Icon name={icon} size={18} />
        </span>
      )}
      <span className="toggle-row__text">
        <span className="toggle-row__label">{label}</span>
        {hint && <span className="toggle-row__hint">{hint}</span>}
      </span>
      <span className={`switch${checked ? ' is-on' : ''}`} aria-hidden="true">
        <span className="switch__dot" />
      </span>
    </button>
  )
}

/* ---------- segmented control ---------- */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (next: T) => void
  label: string
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`segmented__item${o.value === value ? ' is-active' : ''}`}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ---------- avatar ---------- */

export function Avatar({
  id = 'vanta',
  initials,
  size = 32,
  className,
}: {
  id?: AvatarId
  initials?: string
  size?: number
  className?: string
}) {
  const gid = useId().replace(/[:]/g, '')
  const def = AVATAR_OPTIONS.find((a) => a.id === id) ?? AVATAR_OPTIONS[0]
  return (
    <span
      className={`avatar ${className ?? ''}`}
      style={{ width: size, height: size, fontSize: size * 0.33 }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 40 40" width={size} height={size}>
        <defs>
          <radialGradient id={`av-${gid}`} cx="35%" cy="28%" r="85%">
            <stop offset="0%" stopColor={def.a} />
            <stop offset="100%" stopColor={def.b} />
          </radialGradient>
        </defs>
        <circle cx="20" cy="20" r="20" fill={`url(#av-${gid})`} />
        <circle cx="20" cy="20" r="20" fill="none" stroke="rgba(10,12,8,0.35)" />
        <path d="M20 13.5 26.5 20 20 26.5 13.5 20Z" fill="rgba(18,20,14,0.5)" />
      </svg>
      {initials && <span className="avatar__initials">{initials}</span>}
    </span>
  )
}

/* ---------- balance pill ---------- */

export function BalancePill({ compact }: { compact?: boolean }) {
  const { state } = useApp()
  return (
    <span className={`balance-chip${compact ? ' balance-chip--compact' : ''}`}>
      <Icon name="coin" size={15} className="coin-lead" />
      <span className="balance-chip__value num">
        {state.balance.toLocaleString('en-US')}
      </span>
      <span className="balance-chip__unit">VC</span>
    </span>
  )
}

/* ---------- modal / confirmation ---------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  labelledBy,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  labelledBy?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const id = labelledBy ?? 'modal-title'

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    ref.current?.focus()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="modal-scrim" onClick={onClose} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
        ref={ref}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <h2 className="title-md" id={id}>
            {title}
          </h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close dialog">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>
  )
}

/* ---------- toast host ---------- */

export function ToastHost() {
  const { toasts, dismissToast } = useApp()
  return (
    <div className="toast-host" role="status" aria-live="polite">
      {toasts.map((t) => (
        <button
          key={t.id}
          className={`toast toast--${t.tone}`}
          onClick={() => dismissToast(t.id)}
          type="button"
        >
          <span className="toast__icon" aria-hidden="true">
            <Icon name={t.icon} size={17} />
          </span>
          <span className="toast__text">
            <span className="toast__title">{t.title}</span>
            {t.body && <span className="toast__body">{t.body}</span>}
          </span>
          {t.amount != null && (
            <span className="toast__amount num">+{t.amount.toLocaleString('en-US')}</span>
          )}
        </button>
      ))}
    </div>
  )
}

/* ---------- skeleton ---------- */

export function Skeleton({
  w = '100%',
  h = 14,
  radius = 4,
}: {
  w?: string | number
  h?: number
  radius?: number
}) {
  return (
    <span
      className="skeleton"
      style={{ width: w, height: h, borderRadius: radius }}
      aria-hidden="true"
    />
  )
}

/* ---------- empty state ---------- */

export function EmptyState({
  icon = 'history',
  title,
  body,
  action,
}: {
  icon?: IconName
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <span className="empty__icon" aria-hidden="true">
        <Icon name={icon} size={26} />
      </span>
      <p className="empty__title">{title}</p>
      {body && <p className="empty__body">{body}</p>}
      {action && <div className="empty__action">{action}</div>}
    </div>
  )
}

/* ---------- theme swatches ---------- */
