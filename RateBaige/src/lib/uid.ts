/* ------------------------------------------------------------------
   VANTA — id generation.
   Kept in its own module so component files only export components
   (react-refresh) and so every id path shares one implementation.
   ------------------------------------------------------------------ */

let counter = 0

/** Short, collision-resistant id. Not a security primitive. */
export function uid(prefix = 'id'): string {
  counter += 1
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}-${Date.now().toString(36)}-${rand}-${counter}`
}
