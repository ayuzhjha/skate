/* ------------------------------------------------------------------
   VANTA — statistics & history filtering.
   Everything is derived from recorded rounds; nothing is hardcoded.
   ------------------------------------------------------------------ */

import type { GameId, Round } from './types.ts'

export type TailStats = {
  played: number
  wins: number
  losses: number
  pushes: number
  blackjacks: number
  staked: number
  returned: number
  net: number
  winRate: number
}

export type Stats = TailStats & {
  busts: number
  decided: number
  biggestWin: number
  biggestLoss: number
  avgStake: number
  byGame: Record<GameId, TailStats>
  recent: Round[]
  sparkline: number[]
}

function emptyTail(): TailStats {
  return {
    played: 0,
    wins: 0,
    losses: 0,
    pushes: 0,
    blackjacks: 0,
    staked: 0,
    returned: 0,
    net: 0,
    winRate: 0,
  }
}

function isWin(r: Round): boolean {
  return r.result === 'win' || r.result === 'blackjack'
}

function isLoss(r: Round): boolean {
  return r.result === 'loss' || r.result === 'bust'
}

function finalise(tail: TailStats): TailStats {
  const decided = tail.wins + tail.losses
  return { ...tail, winRate: decided > 0 ? tail.wins / decided : 0 }
}

export function computeStats(rounds: Round[]): Stats {
  const total = emptyTail()
  const byGame: Record<GameId, TailStats> = {
    blackjack: emptyTail(),
    roulette: emptyTail(),
    poker: emptyTail(),
    slots: emptyTail(),
  }
  let busts = 0
  let biggestWin = 0
  let biggestLoss = 0

  for (const r of rounds) {
    const g = byGame[r.game] ?? (byGame[r.game] = emptyTail())
    for (const bucket of [total, g]) {
      bucket.played += 1
      bucket.staked += r.stake
      bucket.returned += r.payout
      bucket.net += r.net
      if (isWin(r)) bucket.wins += 1
      else if (isLoss(r)) bucket.losses += 1
      else bucket.pushes += 1
      if (r.result === 'blackjack') bucket.blackjacks += 1
    }
    if (r.result === 'bust') busts += 1
    if (r.net > biggestWin) biggestWin = r.net
    if (r.net < biggestLoss) biggestLoss = r.net
  }

  const recent = rounds.slice(0, 10)
  return {
    ...finalise(total),
    busts,
    decided: total.wins + total.losses,
    biggestWin,
    biggestLoss,
    avgStake: total.played > 0 ? Math.round(total.staked / total.played) : 0,
    byGame: {
      blackjack: finalise(byGame.blackjack),
      roulette: finalise(byGame.roulette),
      poker: finalise(byGame.poker),
      slots: finalise(byGame.slots),
    },
    recent,
    sparkline: rounds
      .slice(0, 12)
      .map((r) => r.net)
      .reverse(),
  }
}

export type OutcomeFilter = 'all' | 'win' | 'loss' | 'push'

export type HistoryFilter = {
  game: GameId | 'all'
  outcome: OutcomeFilter
  /** Epoch ms lower bound, inclusive. */
  from?: number
}

export function filterRounds(rounds: Round[], filter: HistoryFilter): Round[] {
  return rounds.filter((r) => {
    if (filter.game !== 'all' && r.game !== filter.game) return false
    if (filter.from != null && r.at < filter.from) return false
    if (filter.outcome === 'win' && !isWin(r)) return false
    if (filter.outcome === 'loss' && !isLoss(r)) return false
    if (filter.outcome === 'push' && r.result !== 'push') return false
    return true
  })
}
