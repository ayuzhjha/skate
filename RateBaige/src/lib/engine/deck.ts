/* ------------------------------------------------------------------
   VANTA — cards & deck primitives
   Self-contained (only type imports) so it can be executed directly
   by Node's type-stripping test harness.
   ------------------------------------------------------------------ */

export type Suit = 'spade' | 'heart' | 'diamond' | 'club'
export type Rank =
  | 'A'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K'

export type Card = {
  id: string
  rank: Rank
  suit: Suit
}

export const SUITS: Suit[] = ['spade', 'heart', 'diamond', 'club']

export const RANKS: Rank[] = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
]

export const RANK_LABEL: Record<Rank, string> = {
  A: 'A',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '10': '10',
  J: 'J',
  Q: 'Q',
  K: 'K',
}

/** Blackjack value of a single card with the ace counted high. */
export function cardValue(rank: Rank): number {
  if (rank === 'A') return 11
  if (rank === 'K' || rank === 'Q' || rank === 'J') return 10
  return Number(rank)
}

export type HandValue = {
  total: number
  /** True when an ace is currently counted as 11. */
  soft: boolean
}

/** Best blackjack total for a set of cards. */
export function handValue(cards: Card[]): HandValue {
  let total = 0
  let aces = 0
  for (const card of cards) {
    total += cardValue(card.rank)
    if (card.rank === 'A') aces += 1
  }
  while (total > 21 && aces > 0) {
    total -= 10
    aces -= 1
  }
  return { total, soft: aces > 0 && total <= 21 }
}

/** A two-card 21. */
export function isNatural(cards: Card[]): boolean {
  return cards.length === 2 && handValue(cards).total === 21
}

/** Whether two cards form an eligible split pair. */
export function isPair(a: Card, b: Card): boolean {
  return cardValue(a.rank) === cardValue(b.rank)
}

/* ---------- deterministic RNG ---------- */

/** Small, fast, seedable PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = t
    r = Math.imul(r ^ (r >>> 15), r | 1)
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/** Build a shuffled shoe of `decks` decks. Deterministic for a given seed. */
export function createShoe(decks: number, seed: number): Card[] {
  const rng = mulberry32(seed)
  const cards: Card[] = []
  for (let d = 0; d < decks; d += 1) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ id: `${rank}${suit[0]}${d}`, rank, suit })
      }
    }
  }
  // Fisher–Yates
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = cards[i]
    cards[i] = cards[j]
    cards[j] = tmp
  }
  return cards
}

/** Suit symbol for display. */
export const SUIT_SYMBOL: Record<Suit, string> = {
  spade: '\u2660',
  heart: '\u2665',
  diamond: '\u2666',
  club: '\u2663',
}
