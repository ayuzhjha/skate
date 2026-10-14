/* ------------------------------------------------------------------
   VANTA — number & date formatting helpers.
   ------------------------------------------------------------------ */

const nf = new Intl.NumberFormat('en-US')

/** 2500 -> "2,500" */
export function formatCredits(n: number): string {
  return nf.format(Math.round(n))
}

/** 250 -> "+250", -100 -> "−100" (true minus sign). */
export function formatSigned(n: number): string {
  const v = Math.round(n)
  if (v > 0) return `+${nf.format(v)}`
  if (v < 0) return `−${nf.format(Math.abs(v))}`
  return '0'
}

/** Signed, but with no leading + for zero-ish neutral values. */
export function formatDelta(n: number): string {
  const v = Math.round(n)
  return v > 0 ? `+${nf.format(v)}` : v < 0 ? `−${nf.format(Math.abs(v))}` : '±0'
}

/** Local calendar key, e.g. "2026-10-14". */
export function dayKey(ts: number): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function msUntilNextDay(ts: number): number {
  const d = new Date(ts)
  const next = new Date(d)
  next.setHours(24, 0, 0, 0)
  return next.getTime() - ts
}

export function formatClock(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
  })
}

export function formatDateTime(ts: number): string {
  return `${formatDate(ts)} · ${formatClock(ts)}`
}

/** "Today", "Yesterday", or a short date. */
export function dayLabel(ts: number, now = Date.now()): string {
  const diff = startOfDay(now) - startOfDay(ts)
  const days = Math.round(diff / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return formatDate(ts)
}

/** Coarse relative time for activity rows. */
export function relativeTime(ts: number, now = Date.now()): string {
  const diff = now - ts
  if (diff < 60_000) return 'Just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return dayLabel(ts, now)
}

/** "01:58" style countdown. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function percent(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`
}
