import { StatusGlyph, type StatusKind } from './art'

export type Direction = 'pos' | 'neg' | 'flat'

export type ActivityEntry = {
  icon: StatusKind
  tone: 'gold' | 'red' | 'plain'
  name: string
  note: string
  time: string
  amount: string
  direction: Direction
}

export function ActivityRow({ entry }: { entry: ActivityEntry }) {
  const iconClass =
    entry.tone === 'gold'
      ? 'row__icon row__icon--gold'
      : entry.tone === 'red'
        ? 'row__icon row__icon--red'
        : 'row__icon'

  return (
    <li className="row">
      <span className={iconClass} aria-hidden="true">
        <StatusGlyph kind={entry.icon} />
      </span>
      <span className="row__label">
        <span className="row__name">{entry.name}</span>
        <span className="row__note">{entry.note}</span>
      </span>
      <span className="row__time num">{entry.time}</span>
      <span className={`row__amount num row__amount--${entry.direction}`}>
        {entry.amount}
        <span className="row__unit">VC</span>
      </span>
    </li>
  )
}
