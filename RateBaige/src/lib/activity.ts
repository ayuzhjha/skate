/* ------------------------------------------------------------------
   VANTA — adapters from recorded data to the ActivityRow view model.
   Pure functions, kept out of the component file so that file only
   exports components.
   ------------------------------------------------------------------ */

import type { ActivityEntry, Direction } from '../components/ActivityRow'
import type { StatusKind } from '../components/art'
import type { Round, Transaction } from './types.ts'
import { formatDateTime, formatDelta } from './format.ts'

const KNOWN: StatusKind[] = ['spark', 'check', 'chip', 'coin', 'flag', 'info']

function toStatus(icon: string): StatusKind {
  return (KNOWN as string[]).includes(icon) ? (icon as StatusKind) : 'info'
}

function dir(amount: number): Direction {
  return amount > 0 ? 'pos' : amount < 0 ? 'neg' : 'flat'
}

const RESULT_LABEL: Record<Round['result'], string> = {
  win: 'Hand won',
  blackjack: 'Blackjack',
  loss: 'Hand lost',
  bust: 'Bust',
  push: 'Push',
}

export function roundToEntry(r: Round): ActivityEntry {
  const win = r.result === 'win' || r.result === 'blackjack'
  const loss = r.result === 'loss' || r.result === 'bust'
  return {
    icon: r.result === 'blackjack' ? 'spark' : win ? 'check' : loss ? 'chip' : 'flag',
    tone: win ? 'gold' : loss ? 'red' : 'plain',
    name: `Blackjack · ${RESULT_LABEL[r.result]}`,
    note: r.detail,
    time: formatDateTime(r.at),
    amount: formatDelta(r.net),
    direction: dir(r.net),
  }
}

export function txnToEntry(t: Transaction): ActivityEntry {
  return {
    icon: toStatus(t.icon),
    tone: t.amount > 0 ? 'gold' : t.amount < 0 ? 'red' : 'plain',
    name: t.label,
    note: t.note ?? (t.amount >= 0 ? 'Credits added' : 'Credits staked'),
    time: formatDateTime(t.at),
    amount: formatDelta(t.amount),
    direction: dir(t.amount),
  }
}
