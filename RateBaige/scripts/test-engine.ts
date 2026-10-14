/* ------------------------------------------------------------------
   VANTA — engine & economy test harness.

   Run directly with Node's native TypeScript stripping:
       node scripts/test-engine.ts

   No test framework, no dependencies. Throws on the first failure.
   ------------------------------------------------------------------ */

import {
  createShoe,
  handValue,
  isNatural,
  mulberry32,
  type Card,
  type Rank,
  type Suit,
} from '../src/lib/engine/deck.ts'
import {
  DECKS,
  applyAction,
  canDouble,
  canHit,
  canSplit,
  describeRound,
  roundResult,
  startRound,
  stakeFor,
  type BjState,
} from '../src/lib/engine/blackjack.ts'
import {
  addXp,
  applyMissionEvent,
  claimDaily,
  claimMission,
  claimRefill,
  createInitialState,
  credit,
  dailyStatus,
  evaluateAchievements,
  grantAchievements,
  missionStatus,
  recordRound,
  refillStatus,
} from '../src/lib/economy.ts'
import { computeStats, filterRounds } from '../src/lib/stats.ts'
import { sanitizeState } from '../src/lib/storage.ts'
import { levelFromXp } from '../src/lib/config.ts'

let passed = 0
const fails: string[] = []

function ok(cond: boolean, label: string, extra?: unknown) {
  if (cond) {
    passed += 1
  } else {
    fails.push(label + (extra !== undefined ? ` → ${JSON.stringify(extra)}` : ''))
  }
}
function eq(actual: unknown, expected: unknown, label: string) {
  ok(
    actual === expected,
    label,
    actual === expected ? undefined : { actual, expected },
  )
}

/* ---------- helpers to build a rigged shoe ---------- */

function card(rank: Rank, suit: Suit = 'spade'): Card {
  return { id: `${rank}${suit}`, rank, suit }
}

/**
 * A state whose shoe is the exact card order given (first drawn first).
 * Deal order is player, dealer, player, dealer, so player holds
 * cards[0]+cards[2] and the dealer holds cards[1]+cards[3]; any further
 * card in the array is the next one drawn.
 */
function rigged(cards: Card[], stake = 100): BjState {
  const state = startRound(null, stake, 1)
  state.shoe = cards
  state.index = 4
  state.hands[0].cards = [cards[0], cards[2]]
  state.dealer = [cards[1], cards[3]]
  state.hands[0].total = handValue(state.hands[0].cards).total
  state.hands[0].done = false
  state.hands[0].result = null
  state.phase = 'player'
  state.holeRevealed = false
  state.totalStake = stake
  state.totalPayout = 0
  state.outcome = null
  return state
}

/* ================================================================
   1. Card values & aces
   ================================================================ */
eq(handValue([card('A'), card('K')]).total, 21, 'A+K = 21')
ok(handValue([card('A'), card('K')]).soft, 'A+K is soft')
eq(handValue([card('A'), card('A')]).total, 12, 'A+A = 12')
eq(handValue([card('A'), card('A', 'heart'), card('9')]).total, 21, 'A+A+9 = 21')
eq(handValue([card('A'), card('A', 'heart'), card('A', 'club')]).total, 13, 'A+A+A = 13')
eq(handValue([card('K'), card('Q'), card('J')]).total, 30, 'K+Q+J = 30')
eq(handValue([card('A'), card('5'), card('7')]).total, 13, 'A+5+7 = 13 (ace demotes)')
eq(handValue([card('10'), card('9'), card('A')]).total, 20, '10+9+A = 20')
ok(isNatural([card('A'), card('K')]), 'A+K natural')
ok(!isNatural([card('A'), card('5'), card('5')]), '21 in three cards is not a natural')

/* ================================================================
   2. Deck integrity & determinism
   ================================================================ */
const shoeA = createShoe(DECKS, 42)
const shoeB = createShoe(DECKS, 42)
const shoeC = createShoe(DECKS, 43)
eq(shoeA.length, 52 * DECKS, 'shoe has 52 × decks cards')
eq(new Set(shoeA.map((c) => c.id)).size, shoeA.length, 'shoe has no duplicate ids')
eq(
  shoeA.map((c) => c.id).join(','),
  shoeB.map((c) => c.id).join(','),
  'same seed → identical shoe',
)
ok(
  shoeA.map((c) => c.id).join(',') !== shoeC.map((c) => c.id).join(','),
  'different seed → different shoe',
)
const rng = mulberry32(7)
ok(
  Array.from({ length: 5 }, rng).every((n) => n >= 0 && n < 1),
  'rng values are in [0,1)',
)

/* ================================================================
   3. Start of round basics
   ================================================================ */
const fresh = startRound(null, 100, 5)
eq(fresh.hands.length, 1, 'one hand to start')
eq(fresh.hands[0].cards.length, 2, 'player has two cards')
eq(fresh.dealer.length, 2, 'dealer has two cards')
eq(fresh.totalStake, 100, 'stake recorded')
ok(fresh.phase === 'player' || fresh.phase === 'settled', 'phase is player or settled')

/* ================================================================
   4. Rigged outcomes
   ================================================================ */

// 4a. Player natural vs dealer 20 → blackjack pays 3:2 (floor)
{
  const s = rigged([card('A'), card('10', 'heart'), card('K'), card('9', 'club')])
  // force natural resolution like startRound would
  s.holeRevealed = true
  const settled = applyAction(s, 'stand') // stand then dealer draws to 19
  // dealer will draw until >=17; it's already 19
  eq(settled.hands[0].result, 'blackjack', 'player natural → blackjack')
  eq(settled.totalPayout, 100 + Math.floor((100 * 3) / 2), 'blackjack pays 3:2')
  eq(settled.outcome, 'win', 'outcome win')
}

// 4b. Both naturals → push
{
  const s = rigged([card('A'), card('A', 'heart'), card('K'), card('K', 'club')])
  s.holeRevealed = true
  const settled = applyAction(s, 'stand')
  eq(settled.hands[0].result, 'push', 'both naturals → push')
  eq(settled.totalPayout, 100, 'push returns the stake')
  eq(settled.outcome, 'push', 'outcome push')
}

// 4c. Dealer natural vs player 20 → loss
{
  const s = rigged([card('10'), card('A', 'heart'), card('K'), card('K', 'club')])
  s.holeRevealed = true
  const settled = applyAction(s, 'stand')
  eq(settled.hands[0].result, 'loss', 'dealer natural beats 20')
  eq(settled.totalPayout, 0, 'loss pays nothing')
}

// 4d. Player busts
{
  const s = rigged([card('10'), card('9', 'heart'), card('6'), card('7', 'club'), card('K', 'diamond')])
  const busted = applyAction(s, 'hit') // 10+6 = 16, draws K → 26
  eq(busted.hands[0].result, 'bust', 'over 21 is a bust')
  eq(busted.totalPayout, 0, 'bust pays nothing')
  if (busted.phase === 'settled') eq(roundResult(busted), 'bust', 'round result bust')
}

// 4e. Dealer busts → player wins 1:1
{
  const s = rigged([card('10'), card('10', 'heart'), card('8'), card('6', 'club'), card('10', 'diamond')]) // player 18, dealer 16
  const out = applyAction(s, 'stand') // dealer 16 → draws 10 → 26 bust
  eq(out.dealer.length, 3, 'dealer drew one card')
  eq(out.hands[0].result, 'win', 'dealer bust → win')
  eq(out.totalPayout, 200, 'win pays 1:1 (200 gross)')
}

// 4f. Equal totals → push
{
  const s = rigged([card('10'), card('10', 'heart'), card('8'), card('8', 'club')])
  const out = applyAction(s, 'stand')
  eq(out.hands[0].result, 'push', 'equal totals push')
  eq(out.totalPayout, 100, 'push returns stake')
}

// 4g. Dealer stands on soft 17 (S17)
{
  const s = rigged([card('10'), card('A', 'heart'), card('9'), card('6', 'club')]) // dealer A+6 = soft 17
  const out = applyAction(s, 'stand')
  eq(out.dealer.length, 2, 'dealer does not hit soft 17')
  // player 19 vs dealer 17 → win
  eq(out.hands[0].result, 'win', 'player 19 beats soft 17')
}

/* ================================================================
   5. Double down
   ================================================================ */
{
  const s = rigged([
    card('5'),
    card('9', 'heart'),
    card('6'),
    card('7', 'club'),
    card('10', 'diamond'), // the doubled card → 21
    card('2'),
    card('2'),
  ]) // player 11, dealer 16
  ok(canDouble(s), 'can double on first two cards')
  eq(stakeFor(s, 'double'), 100, 'double needs one more base stake')
  const out = applyAction(s, 'double') // 11 + 10 = 21
  eq(out.hands[0].stake, 200, 'doubled stake is 2× base')
  eq(out.totalStake, 200, 'totalStake reflects the double')
  eq(out.hands[0].result, 'win', 'doubled 21 wins')
  eq(out.totalPayout, 400, 'doubled win returns 4× base')
}

/* ================================================================
   6. Split
   ================================================================ */
{
  const s = rigged([
    card('8'),
    card('9', 'heart'),
    card('8', 'club'),
    card('7', 'club'),
    card('10', 'diamond'), // to first hand
    card('3', 'diamond'), // to second hand
  ]) // player 8,8
  ok(canSplit(s), 'can split a pair')
  eq(stakeFor(s, 'split'), 100, 'split needs one more base stake')
  const out = applyAction(s, 'split')
  eq(out.hands.length, 2, 'split produces two hands')
  eq(out.totalStake, 200, 'split commits 2× base')
  eq(out.hands[0].cards.length, 2, 'first split hand has two cards')
  eq(out.hands[1].cards.length, 2, 'second split hand has two cards')
  ok(out.hands[0].split && out.hands[1].split, 'both hands marked as split')
}

// 6b. Split aces get one card each and can't be hit again
{
  const s = rigged([card('A'), card('9', 'heart'), card('A', 'club'), card('7', 'club'), card('5'), card('6')])
  const out = applyAction(s, 'split')
  eq(out.hands.length, 2, 'aces split')
  ok(out.hands[0].done && out.hands[1].done, 'split aces are immediately done')
  ok(!canHit(out) || out.hands[out.active]?.splitAces !== true, 'cannot hit split aces')
}

/* ================================================================
   7. Invalid actions are refused
   ================================================================ */
{
  const s = rigged([card('10'), card('9', 'heart'), card('7'), card('7', 'club'), card('2')]) // 17, no pair
  ok(!canSplit(s), 'cannot split a non-pair')
  const after = applyAction(s, 'hit')
  const threeCards = after.hands[after.active] ?? after.hands[0]
  eq(threeCards.cards.length, 3, 'third card drawn')
  ok(!canDouble(after), 'cannot double after three cards')
}
{
  // settle is idempotent-ish: standing on a settled board does nothing
  const s = rigged([card('10'), card('10', 'heart'), card('8'), card('8', 'club')])
  const settled = applyAction(s, 'stand')
  const again = applyAction(settled, 'stand')
  eq(again.totalPayout, settled.totalPayout, 'no actions after settle')
}

/* ================================================================
   8. Economy — atomic credit mutation
   ================================================================ */
const T0 = Date.UTC(2026, 9, 14, 12, 0, 0) // 14 Oct 2026, 12:00 UTC
let app = createInitialState(T0)
eq(app.balance, 2500, 'starts at 2500 VC')
eq(app.transactions.length, 1, 'one starting transaction')
eq(app.transactions[0].balanceAfter, 2500, 'starting txn records resulting balance')

{
  const spend = credit(app, {
    id: 'tx-stake-1',
    at: T0 + 1000,
    type: 'stake',
    amount: -100,
    label: 'Blackjack stake',
    icon: 'chip',
  })
  ok(spend.ok, 'stake succeeds')
  eq(spend.state.balance, 2400, 'balance drops by 100')
  app = spend.state

  const replay = credit(app, {
    id: 'tx-stake-1',
    at: T0 + 2000,
    type: 'stake',
    amount: -100,
    label: 'Blackjack stake',
    icon: 'chip',
  })
  ok(!replay.ok && replay.reason === 'duplicate', 'duplicate transaction id rejected')

  const tooBig = credit(app, {
    id: 'tx-stake-2',
    at: T0 + 3000,
    type: 'stake',
    amount: -999999,
    label: 'Huge stake',
    icon: 'chip',
  })
  ok(!tooBig.ok && tooBig.reason === 'insufficient', 'cannot go negative')
  eq(tooBig.state.balance, 2400, 'rejected debit leaves balance untouched')

  const bad = credit(app, {
    id: 'tx-bad',
    at: T0 + 4000,
    type: 'adjustment',
    amount: 0.4,
    label: 'Zero',
    icon: 'info',
  })
  eq(bad.reason, 'invalid-amount', 'zero-ish amount rejected')
}

/* ================================================================
   9. Rounds, stats & achievements
   ================================================================ */
{
  app = recordRound(app, {
    id: 'r1',
    at: T0 + 5000,
    game: 'blackjack',
    stake: 100,
    payout: 200,
    result: 'win',
    detail: 'Dealer 19 · You 21',
    playerTotal: 21,
    dealerTotal: 19,
    hands: 1,
  })
  app = recordRound(app, {
    id: 'r2',
    at: T0 + 6000,
    game: 'blackjack',
    stake: 50,
    payout: 0,
    result: 'loss',
    detail: 'Dealer 20 · You 18',
    playerTotal: 18,
    dealerTotal: 20,
    hands: 1,
  })
  // duplicate round id ignored
  const before = app.rounds.length
  app = recordRound(app, {
    id: 'r1',
    at: T0 + 7000,
    game: 'blackjack',
    stake: 100,
    payout: 200,
    result: 'win',
    detail: 'dup',
    playerTotal: 21,
    dealerTotal: 19,
    hands: 1,
  })
  eq(app.rounds.length, before, 'duplicate round id ignored')

  const stats = computeStats(app.rounds)
  eq(stats.played, 2, 'stats counts 2 rounds')
  eq(stats.wins, 1, 'stats wins')
  eq(stats.losses, 1, 'stats losses')
  eq(stats.net, 50, 'stats net = +50')
  eq(stats.winRate, 0.5, 'win rate 50%')
  eq(stats.byGame.blackjack.played, 2, 'per-game stats')

  eq(filterRounds(app.rounds, { game: 'blackjack', outcome: 'win' }).length, 1, 'filter win')
  eq(filterRounds(app.rounds, { game: 'roulette', outcome: 'all' }).length, 0, 'filter other game')

  const eligible = evaluateAchievements(app)
  ok(eligible.includes('firstRound'), 'firstRound unlocked')
  ok(eligible.includes('firstWin'), 'firstWin unlocked')
  const granted = grantAchievements(app, eligible, T0 + 8000)
  app = granted.state
  ok(granted.xp > 0, 'achievements award xp')
  ok(evaluateAchievements(app).length === 0, 'no double-unlock after granting')
  const xpAfter = addXp(app, 60)
  app = xpAfter.state
  ok(levelFromXp(app.player.xp).level >= 1, 'level derives from xp')
}

/* ================================================================
   10. Daily reward, streak & duplicate prevention
   ================================================================ */
{
  const d1 = dailyStatus(app, T0)
  ok(!d1.claimedToday, 'daily not yet claimed')
  eq(d1.nextStreak, 1, 'first claim is day 1')
  eq(d1.amount, 250, 'day 1 pays 250')

  const c1 = claimDaily(app, { id: 'd1', at: T0 })
  ok(c1.ok, 'first daily claim succeeds')
  eq(c1.state.rewards.streak, 1, 'streak is 1')
  app = c1.state

  const dup = claimDaily(app, { id: 'd2', at: T0 + 3600_000 })
  ok(!dup.ok && dup.reason === 'already-claimed', 'cannot claim twice in a day')

  const nextDay = T0 + 86_400_000
  const d2 = dailyStatus(app, nextDay)
  eq(d2.nextStreak, 2, 'next day continues the streak')
  eq(d2.amount, 300, 'day 2 pays 300')
  const c2 = claimDaily(app, { id: 'd2b', at: nextDay })
  ok(c2.ok, 'second-day claim succeeds')
  eq(c2.state.rewards.streak, 2, 'streak is 2')
  app = c2.state

  const gap = nextDay + 3 * 86_400_000
  eq(dailyStatus(app, gap).nextStreak, 1, 'a missed day resets the streak')
}

/* ================================================================
   11. Refill & missions
   ================================================================ */
{
  const poor = { ...app, balance: 40 }
  ok(refillStatus(poor, T0).eligible, 'refill is offered when broke')
  ok(!refillStatus(app, T0).eligible, 'no refill when balance is healthy')
  const r = claimRefill(poor, { id: 'rf1', at: T0 + 10_000_000 })
  ok(r.ok, 'refill claim succeeds')
  const r2 = claimRefill(r.state, { id: 'rf2', at: T0 + 10_000_001 })
  ok(!r2.ok, 'refill respects cooldown')
}

{
  let m = app
  m = applyMissionEvent(m, { kind: 'round', won: true, reached21: true, wager: 100 }, T0)
  m = applyMissionEvent(m, { kind: 'round', won: true, reached21: false, wager: 100 }, T0)
  m = applyMissionEvent(m, { kind: 'round', won: false, reached21: false, wager: 150 }, T0)
  const play3 = missionStatus(m, 'play3')
  ok(play3.complete, 'play3 mission completes after 3 rounds')
  const win2 = missionStatus(m, 'win2')
  ok(win2.complete, 'win2 completes after 2 wins')
  eq(missionStatus(m, 'wager300').progress, 300, 'wager300 accumulates (capped)')
  const claim = claimMission(m, 'play3', { id: 'm1', at: T0 + 20_000 })
  ok(claim.ok, 'mission claim succeeds')
  const reclaim = claimMission(claim.state, 'play3', { id: 'm2', at: T0 + 30_000 })
  ok(!reclaim.ok && reclaim.reason === 'already-claimed', 'mission cannot be re-claimed')
}

/* ================================================================
   12. Persistence sanitisation
   ================================================================ */
{
  const restored = sanitizeState(JSON.parse(JSON.stringify(app)), T0)
  eq(restored.balance, app.balance, 'round-trips balance')
  eq(restored.rounds.length, app.rounds.length, 'round-trips rounds')
  const corrupt = sanitizeState({ version: 999, balance: -5 }, T0)
  eq(corrupt.balance, 2500, 'bad version resets to a fresh state')
  const partial = sanitizeState({ version: 1, balance: 'oops', player: {} }, T0)
  eq(partial.balance, 2500, 'unparseable balance falls back')
  const negative = sanitizeState({ version: 1, balance: -100 }, T0)
  eq(negative.balance, 0, 'negative stored balance is clamped to 0')
}

/* ================================================================
   Report
   ================================================================ */
const total = passed + fails.length
if (fails.length) {
  console.error(`\n✗ ${fails.length}/${total} checks failed:\n`)
  for (const f of fails) console.error('  • ' + f)
  process.exit(1)
}
console.log(`\n✓ all ${total} engine & economy checks passed`)
console.log(`  sample round: ${describeRound(startRound(null, 100, 9))}`)
