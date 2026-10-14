/* ------------------------------------------------------------------
   VANTA — Blackjack rules engine
   Pure, deterministic, side-effect free. It NEVER moves credits: it
   only reports how much has been committed to the table (totalStake)
   and how much should come back (totalPayout). The store turns those
   numbers into ledger transactions.

   Ruleset (also surfaced in the How to Play screen):
   • 6 decks, shuffled into a shoe; reshuffle at ~75% penetration.
   • Dealer stands on all 17 (S17). No insurance offered.
   • Blackjack (two-card 21, unsplit) pays 3:2, rounded down.
   • A win pays 1:1; a push returns the stake.
   • Double down on any first two cards; one card is then drawn.
   • Split equal-value pairs up to 4 hands. Split aces receive one
     card each and cannot be hit again.
   ------------------------------------------------------------------ */

import type { Card } from './deck.ts'
import { createShoe, handValue, isNatural, isPair } from './deck.ts'

export const DECKS = 6
/** Reshuffle once the shoe is this far consumed. */
export const PENETRATION = 0.75

export type BjResult = 'win' | 'loss' | 'push' | 'blackjack' | 'bust'

export type BjHand = {
  cards: Card[]
  /** Credits committed to this hand (doubles included). */
  stake: number
  doubled: boolean
  split: boolean
  splitAces: boolean
  done: boolean
  result: BjResult | null
  /** Gross credits returned for this hand. */
  payout: number
  /** Total at the moment the hand finished (for display). */
  total: number
}

export type BjPhase = 'player' | 'dealer' | 'settled'

export type BjState = {
  shoe: Card[]
  index: number
  seed: number
  baseStake: number
  hands: BjHand[]
  active: number
  dealer: Card[]
  holeRevealed: boolean
  phase: BjPhase
  totalStake: number
  totalPayout: number
  outcome: 'win' | 'loss' | 'push' | null
}

export type BjAction = 'hit' | 'stand' | 'double' | 'split'

let shoeCounter = 0

function freshHand(stake: number): BjHand {
  return {
    cards: [],
    stake,
    doubled: false,
    split: false,
    splitAces: false,
    done: false,
    result: null,
    payout: 0,
    total: 0,
  }
}

function clone(s: BjState): BjState {
  return {
    ...s,
    shoe: s.shoe,
    hands: s.hands.map((h) => ({ ...h, cards: h.cards.slice() })),
    dealer: s.dealer.slice(),
  }
}

function draw(d: BjState): Card {
  if (d.index >= d.shoe.length) {
    shoeCounter += 1
    d.shoe = createShoe(DECKS, (d.seed + shoeCounter * 7919) >>> 0)
    d.index = 0
  }
  const card = d.shoe[d.index]
  d.index += 1
  return card
}

export function activeHand(s: BjState): BjHand {
  return s.hands[s.active]
}

export function handTotal(cards: Card[]): number {
  return handValue(cards).total
}

export function dealerTotal(s: BjState): number {
  // While the hole card is face down the dealer total reflects the upcard only.
  const cards = s.holeRevealed ? s.dealer : s.dealer.slice(0, 1)
  return handValue(cards).total
}

/** Begin a round. `seed` selects the shoe for a fresh session. */
export function startRound(prev: BjState | null, stake: number, seed: number): BjState {
  let shoe = prev?.shoe ?? []
  let index = prev?.index ?? 0
  const needsShuffle =
    !prev || shoe.length === 0 || index > shoe.length * PENETRATION
  if (needsShuffle) {
    shoe = createShoe(DECKS, seed >>> 0)
    index = 0
  }

  const d: BjState = {
    shoe,
    index,
    seed: seed >>> 0,
    baseStake: stake,
    hands: [freshHand(stake)],
    active: 0,
    dealer: [],
    holeRevealed: false,
    phase: 'player',
    totalStake: stake,
    totalPayout: 0,
    outcome: null,
  }

  d.hands[0].cards.push(draw(d))
  d.dealer.push(draw(d))
  d.hands[0].cards.push(draw(d))
  d.dealer.push(draw(d))
  d.hands[0].total = handTotal(d.hands[0].cards)

  // Immediate resolutions: naturals on either side end the round at once.
  const playerNatural = isNatural(d.hands[0].cards)
  const dealerNatural = isNatural(d.dealer)
  if (playerNatural || dealerNatural) {
    d.holeRevealed = true
    settle(d)
  }
  return d
}

export function canHit(s: BjState): boolean {
  const h = activeHand(s)
  return s.phase === 'player' && !!h && !h.done && !h.splitAces
}

export function canStand(s: BjState): boolean {
  const h = activeHand(s)
  return s.phase === 'player' && !!h && !h.done
}

/** Rule-legal double (affordability is checked by the caller). */
export function canDouble(s: BjState): boolean {
  const h = activeHand(s)
  if (s.phase !== 'player' || !h || h.done) return false
  if (h.cards.length !== 2 || h.splitAces) return false
  // No double after a split if there are more than 2 cards.
  return h.cards.length === 2
}

/** Rule-legal split (affordability + hand limit checked here). */
export function canSplit(s: BjState): boolean {
  const h = activeHand(s)
  if (s.phase !== 'player' || !h || h.done) return false
  if (h.cards.length !== 2) return false
  if (s.hands.length >= 4) return false
  return isPair(h.cards[0], h.cards[1])
}

/** Extra credits required to perform an action (0 if none). */
export function stakeFor(s: BjState, action: BjAction): number {
  if (action === 'double') return canDouble(s) ? s.baseStake : 0
  if (action === 'split') return canSplit(s) ? s.baseStake : 0
  return 0
}

export function hit(s: BjState): BjState {
  if (!canHit(s)) return s
  const d = clone(s)
  const h = d.hands[d.active]
  h.cards.push(draw(d))
  h.total = handTotal(h.cards)
  if (h.total > 21) {
    h.result = 'bust'
    h.payout = 0
    h.done = true
    advance(d)
  } else if (h.total === 21) {
    h.done = true
    advance(d)
  }
  return d
}

export function stand(s: BjState): BjState {
  if (!canStand(s)) return s
  const d = clone(s)
  d.hands[d.active].done = true
  advance(d)
  return d
}

export function double(s: BjState): BjState {
  if (!canDouble(s)) return s
  const d = clone(s)
  const h = d.hands[d.active]
  h.cards.push(draw(d))
  h.stake += d.baseStake
  h.doubled = true
  h.total = handTotal(h.cards)
  d.totalStake += d.baseStake
  if (h.total > 21) h.result = 'bust'
  h.done = true
  advance(d)
  return d
}

export function split(s: BjState): BjState {
  if (!canSplit(s)) return s
  const d = clone(s)
  const h = d.hands[d.active]
  const moved = h.cards.pop() as Card
  const extra = freshHand(d.baseStake)
  extra.cards.push(moved)
  extra.split = true
  h.split = true
  d.hands.splice(d.active + 1, 0, extra)
  d.totalStake += d.baseStake

  h.cards.push(draw(d))
  extra.cards.push(draw(d))
  h.total = handTotal(h.cards)
  extra.total = handTotal(extra.cards)

  if (h.cards[0].rank === 'A') {
    h.splitAces = true
    extra.splitAces = true
    h.done = true
    extra.done = true
  } else {
    if (h.total === 21) h.done = true
    if (extra.total === 21) extra.done = true
  }
  advance(d)
  return d
}

export function applyAction(s: BjState, action: BjAction): BjState {
  switch (action) {
    case 'hit':
      return hit(s)
    case 'stand':
      return stand(s)
    case 'double':
      return double(s)
    case 'split':
      return split(s)
    default:
      return s
  }
}

function advance(d: BjState): void {
  const next = d.hands.findIndex((h) => !h.done)
  if (next === -1) {
    dealerPlay(d)
  } else {
    d.active = next
  }
}

function dealerPlay(d: BjState): void {
  d.phase = 'dealer'
  d.holeRevealed = true
  const anyLive = d.hands.some((h) => handTotal(h.cards) <= 21)
  if (anyLive) {
    while (handValue(d.dealer).total < 17) {
      d.dealer.push(draw(d))
    }
  }
  settle(d)
}

function settle(d: BjState): void {
  const dTotal = handValue(d.dealer).total
  const dealerBust = dTotal > 21
  const dealerNatural = isNatural(d.dealer)
  let payout = 0
  let stake = 0

  for (const h of d.hands) {
    stake += h.stake
    const pv = handValue(h.cards).total
    h.total = pv

    if (pv > 21) {
      h.result = 'bust'
      h.payout = 0
    } else if (h.cards.length === 2 && !h.split && pv === 21) {
      // Player natural. Push against a dealer natural, otherwise 3:2.
      if (dealerNatural) {
        h.result = 'push'
        h.payout = h.stake
      } else {
        h.result = 'blackjack'
        h.payout = h.stake + Math.floor((h.stake * 3) / 2)
      }
    } else if (dealerNatural) {
      h.result = 'loss'
      h.payout = 0
    } else if (dealerBust || pv > dTotal) {
      h.result = 'win'
      h.payout = h.stake * 2
    } else if (pv < dTotal) {
      h.result = 'loss'
      h.payout = 0
    } else {
      h.result = 'push'
      h.payout = h.stake
    }
    payout += h.payout
  }

  d.totalStake = stake
  d.totalPayout = payout
  d.phase = 'settled'
  d.outcome = payout > stake ? 'win' : payout < stake ? 'loss' : 'push'
}

/** Headline result for the recorded round. */
export function roundResult(s: BjState): BjResult {
  if (s.hands.some((h) => h.result === 'blackjack')) return 'blackjack'
  if (s.hands.every((h) => h.result === 'bust')) return 'bust'
  if (s.outcome === 'win') return 'win'
  if (s.outcome === 'push') return 'push'
  return 'loss'
}

/** Human-readable summary of the settled table, e.g. "Dealer 19 · You 21". */
export function describeRound(s: BjState): string {
  const dTotal = handValue(s.dealer).total
  const yours = s.hands.map((h) => handTotal(h.cards)).join(' / ')
  return `Dealer ${dTotal} · You ${yours}`
}

/** Every hand that reached 21 exactly (for the "Twenty-one" mission). */
export function reachedTwentyOne(s: BjState): boolean {
  return s.hands.some((h) => handTotal(h.cards) === 21 && h.result !== 'bust')
}
