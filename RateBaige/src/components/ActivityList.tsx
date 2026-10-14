/* ------------------------------------------------------------------
   VANTA — activity list presentation.
   The data adapters live in lib/activity.ts so this module stays
   component-only.
   ------------------------------------------------------------------ */

import { ActivityRow, type ActivityEntry } from './ActivityRow'

export function ActivityList({
  entries,
  empty,
}: {
  entries: ActivityEntry[]
  empty?: React.ReactNode
}) {
  if (entries.length === 0) return <>{empty}</>
  return (
    <ul className="rows">
      {entries.map((entry, i) => (
        <ActivityRow key={`${entry.name}-${entry.time}-${i}`} entry={entry} />
      ))}
    </ul>
  )
}
