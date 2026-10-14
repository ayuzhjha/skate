/* ------------------------------------------------------------------
   VANTA — economy: the single, authoritative path for every credit
   and progression mutation.

   These functions are pure: they take an AppState and return a new
   one. The React store simply calls them, which keeps credit maths
   testable without a DOM and makes "atomic, validated" mutations a
   property of the model rather than of the UI.
   ------------------------------------------------------------------ */

import type {
  AchievementId,
  AppState,
  GameId,
  IconName,
  MissionId,
  MissionProgress,
  Player,
  RewardState,
  Round,
  RoundResult,
  Transaction,
  TxnType,
} from './types.ts'
import {
  ACHIEVEMENT_BY_ID,
  ACHIEVEMENTS,
  DAILY_STREAK_MAX_DAYS,
  MISSION_BY_ID,
  MISSIONS,
  REFILL_AMOUNT,
  REFILL_COOLDOWN_MS,
  REFILL_THRESHOLD,
  SCHEMA_VERSION,
  STARTING_BALANCE,
  dailyRewardFor,
  levelFromXp,
} from './config.ts'
import { dayKey } from './format.ts'

const MAX_TRANSACTIONS = 500
const MAX_ROUNDS = 500

/* ---------- constructors ---------- */

export function freshRewards(now: number): RewardState {
  const missions = {} as Record<MissionId, MissionProgress>
  for (const m of MISSIONS) missions[m.id] = { progress: 0, claimedAt: null }
  return {
    dailyClaims: [],
    lastDailyAt: null,
    streak: 0,
    refillAt: null,
    missionsDate: dayKey(now),
    missions,
    achievements: {},
  }
}

export function defaultPlayer(now: number): Player {
  return {
    id: 'guest',
    name: 'Ava Verne',
    avatar: 'vanta',
    createdAt: now,
    xp: 0,
    settings: {
      sound: true,
      haptics: true,
      motion: 'system',
      theme: 'obsidian',
      notifications: { daily: true, rewards: true, results: false },
    },
  }
}

export function createInitialState(now: number): AppState {
  const base: AppState = {
    version: SCHEMA_VERSION,
    player: defaultPlayer(now),
    balance: 0,
    transactions: [],
    rounds: [],
    rewards: freshRewards(now),
  }
  const seeded = credit(base, {
    id: 'tx-starting',
    at: now,
    type: 'starting',
    amount: STARTING_BALANCE,
    label: 'Starting balance',
    note: 'Guest account opened',
    icon: 'flag',
  })
  return seeded.state
}

/* ---------- atomic credit mutation ---------- */

export type CreditInput = {
  id: string
  at: number
  type: TxnType
  amount: number
  label: string
  note?: string
  icon: IconName
  roundId?: string
}

export type CreditResult = {
  state: AppState
  ok: boolean
  reason?: 'invalid-amount' | 'duplicate' | 'insufficient'
}

/**
 * The only way credits ever change. Rejects non-integer amounts, replay
 * of an existing transaction id, and anything that would push the
 * balance below zero.
 */
export function credit(state: AppState, input: CreditInput): CreditResult {
  const amount = Math.round(input.amount)
  if (!Number.isFinite(amount) || amount === 0) {
    return { state, ok: false, reason: 'invalid-amount' }
  }
  if (state.transactions.some((t) => t.id === input.id)) {
    return { state, ok: false, reason: 'duplicate' }
  }
  const balance = state.balance + amount
  if (balance < 0) {
    return { state, ok: false, reason: 'insufficient' }
  }
  const tx: Transaction = {
    id: input.id,
    type: input.type,
    amount,
    balanceAfter: balance,
    at: input.at,
    label: input.label,
    note: input.note,
    roundId: input.roundId,
    icon: input.icon,
  }
  return {
    state: {
      ...state,
      balance,
      transactions: [tx, ...state.transactions].slice(0, MAX_TRANSACTIONS),
    },
    ok: true,
  }
}

export function canAfford(state: AppState, amount: number): boolean {
  return state.balance >= Math.round(amount)
}

/* ---------- XP & levels ---------- */

export type XpResult = {
  state: AppState
  level: number
  leveledUp: boolean
}

export function addXp(state: AppState, amount: number): XpResult {
  const gain = Math.max(0, Math.round(amount))
  const before = levelFromXp(state.player.xp).level
  const xp = state.player.xp + gain
  const after = levelFromXp(xp).level
  return {
    state: { ...state, player: { ...state.player, xp } },
    level: after,
    leveledUp: after > before,
  }
}

/* ---------- rounds ---------- */

export type RoundInput = {
  id: string
  at: number
  game: GameId
  stake: number
  payout: number
  result: RoundResult
  detail: string
  playerTotal: number
  dealerTotal: number
  hands: number
}

export function recordRound(state: AppState, input: RoundInput): AppState {
  const stake = Math.round(input.stake)
  const payout = Math.round(input.payout)
  const round: Round = {
    id: input.id,
    game: input.game,
    at: input.at,
    stake,
    payout,
    net: payout - stake,
    result: input.result,
    detail: input.detail,
    playerTotal: input.playerTotal,
    dealerTotal: input.dealerTotal,
    hands: input.hands,
  }
  if (state.rounds.some((r) => r.id === input.id)) return state
  return { ...state, rounds: [round, ...state.rounds].slice(0, MAX_ROUNDS) }
}

/* ---------- daily reward & streak ---------- */

export type DailyStatus = {
  claimedToday: boolean
  streak: number
  /** Streak length that would result from claiming now. */
  nextStreak: number
  amount: number
  today: string
  maxDays: number
}

export function dailyStatus(state: AppState, now: number): DailyStatus {
  const today = dayKey(now)
  const yesterday = dayKey(now - 86_400_000)
  const claimedToday = state.rewards.dailyClaims.includes(today)
  const continuing = state.rewards.dailyClaims.includes(yesterday)
  const nextStreak = claimedToday
    ? state.rewards.streak
    : continuing
      ? state.rewards.streak + 1
      : 1
  return {
    claimedToday,
    streak: state.rewards.streak,
    nextStreak,
    amount: dailyRewardFor(nextStreak),
    today,
    maxDays: DAILY_STREAK_MAX_DAYS,
  }
}

export type DailyClaimResult = {
  state: AppState
  ok: boolean
  reason?: 'already-claimed'
  amount: number
  streak: number
}

export function claimDaily(
  state: AppState,
  ctx: { id: string; at: number },
): DailyClaimResult {
  const status = dailyStatus(state, ctx.at)
  if (status.claimedToday) {
    return { state, ok: false, reason: 'already-claimed', amount: 0, streak: status.streak }
  }
  const rewards: RewardState = {
    ...state.rewards,
    dailyClaims: [...state.rewards.dailyClaims, status.today],
    lastDailyAt: ctx.at,
    streak: status.nextStreak,
  }
  const afterClaim: AppState = { ...state, rewards }
  const res = credit(afterClaim, {
    id: ctx.id,
    at: ctx.at,
    type: status.nextStreak > 1 ? 'streak' : 'daily',
    amount: status.amount,
    label: status.nextStreak > 1 ? `Daily reward · day ${status.nextStreak}` : 'Daily reward',
    note: status.nextStreak > 1 ? `${status.nextStreak}-day streak bonus` : 'Daily credits claimed',
    icon: 'coin',
  })
  return { state: res.state, ok: res.ok, amount: status.amount, streak: status.nextStreak }
}

/* ---------- low-balance refill ---------- */

export type RefillStatus = {
  eligible: boolean
  amount: number
  readyAt: number
}

export function refillStatus(state: AppState, now: number): RefillStatus {
  const last = state.rewards.refillAt ?? 0
  return {
    eligible: state.balance < REFILL_THRESHOLD && now - last >= REFILL_COOLDOWN_MS,
    amount: REFILL_AMOUNT,
    readyAt: last + REFILL_COOLDOWN_MS,
  }
}

export function claimRefill(state: AppState, ctx: { id: string; at: number }): DailyClaimResult {
  const status = refillStatus(state, ctx.at)
  if (!status.eligible) {
    return { state, ok: false, reason: 'already-claimed', amount: 0, streak: 0 }
  }
  const afterClaim: AppState = {
    ...state,
    rewards: { ...state.rewards, refillAt: ctx.at },
  }
  const res = credit(afterClaim, {
    id: ctx.id,
    at: ctx.at,
    type: 'refill',
    amount: status.amount,
    label: 'Free top-up',
    note: 'Low balance refill',
    icon: 'gift',
  })
  return { state: res.state, ok: res.ok, amount: status.amount, streak: 0 }
}

/* ---------- missions ---------- */

export function ensureMissionsToday(state: AppState, now: number): AppState {
  const today = dayKey(now)
  if (state.rewards.missionsDate === today) return state
  return {
    ...state,
    rewards: { ...state.rewards, missionsDate: today, missions: freshRewards(now).missions },
  }
}

export type MissionStatus = {
  id: MissionId
  title: string
  detail: string
  target: number
  reward: number
  progress: number
  complete: boolean
  claimed: boolean
  ratio: number
}

export function missionStatus(state: AppState, id: MissionId): MissionStatus {
  const def = MISSION_BY_ID[id]
  const p = state.rewards.missions[id] ?? { progress: 0, claimedAt: null }
  const progress = Math.min(def.target, p.progress)
  return {
    id,
    title: def.title,
    detail: def.detail,
    target: def.target,
    reward: def.reward,
    progress,
    complete: progress >= def.target,
    claimed: p.claimedAt != null,
    ratio: def.target > 0 ? Math.min(1, progress / def.target) : 0,
  }
}

export function allMissionStatus(state: AppState): MissionStatus[] {
  return MISSIONS.map((m) => missionStatus(state, m.id))
}

export type MissionEvent =
  | { kind: 'round'; won: boolean; reached21: boolean; wager: number }
  | { kind: 'daily' }

export function applyMissionEvent(state: AppState, event: MissionEvent, now: number): AppState {
  let s = ensureMissionsToday(state, now)
  const bump = (id: MissionId, amount: number) => {
    const def = MISSION_BY_ID[id]
    const p = s.rewards.missions[id]
    if (!p || p.claimedAt != null) return
    const next = Math.max(0, Math.min(def.target, p.progress + amount))
    if (next === p.progress) return
    s = {
      ...s,
      rewards: {
        ...s.rewards,
        missions: { ...s.rewards.missions, [id]: { ...p, progress: next } },
      },
    }
  }
  if (event.kind === 'round') {
    bump('play3', 1)
    if (event.won) bump('win2', 1)
    if (event.reached21) bump('hit21', 1)
    bump('wager300', event.wager)
  } else {
    bump('claimDaily', 1)
  }
  return s
}

export type MissionClaimResult = {
  state: AppState
  ok: boolean
  reason?: 'incomplete' | 'already-claimed' | 'insufficient'
  amount: number
}

export function claimMission(
  state: AppState,
  id: MissionId,
  ctx: { id: string; at: number },
): MissionClaimResult {
  const status = missionStatus(state, id)
  if (status.claimed) return { state, ok: false, reason: 'already-claimed', amount: 0 }
  if (!status.complete) return { state, ok: false, reason: 'incomplete', amount: 0 }
  const def = MISSION_BY_ID[id]
  const afterClaim: AppState = {
    ...state,
    rewards: {
      ...state.rewards,
      missions: {
        ...state.rewards.missions,
        [id]: { ...state.rewards.missions[id], claimedAt: ctx.at },
      },
    },
  }
  const res = credit(afterClaim, {
    id: ctx.id,
    at: ctx.at,
    type: 'mission',
    amount: def.reward,
    label: def.title,
    note: 'Daily mission complete',
    icon: 'target',
  })
  return res.ok
    ? { state: res.state, ok: true, amount: def.reward }
    : { state, ok: false, reason: 'insufficient', amount: 0 }
}

/* ---------- achievements ---------- */

export function unlockedAchievements(state: AppState): AchievementId[] {
  return ACHIEVEMENTS.filter((a) => state.rewards.achievements[a.id] != null).map(
    (a) => a.id,
  )
}

/** Which achievements the current state satisfies but that are not yet held. */
export function evaluateAchievements(state: AppState): AchievementId[] {
  const rounds = state.rounds
  const wins = rounds.filter((r) => r.result === 'win' || r.result === 'blackjack').length
  const level = levelFromXp(state.player.xp).level
  const held = state.rewards.achievements
  const out: AchievementId[] = []
  const add = (id: AchievementId, cond: boolean) => {
    if (cond && held[id] == null) out.push(id)
  }
  add('firstRound', rounds.length >= 1)
  add('firstWin', wins >= 1)
  add('natural', rounds.some((r) => r.result === 'blackjack'))
  add('tenRounds', rounds.length >= 10)
  add('century', rounds.length >= 100)
  add('bigStake', rounds.some((r) => r.stake >= 500))
  add('splitWin', rounds.some((r) => r.hands > 1 && r.net > 0))
  add('push', rounds.some((r) => r.result === 'push'))
  add('streak3', state.rewards.streak >= 3)
  add('streak7', state.rewards.streak >= 7)
  add('daily10', state.rewards.dailyClaims.length >= 10)
  add('level5', level >= 5)
  return out
}

export type AchievementGrant = {
  state: AppState
  unlocked: { id: AchievementId; title: string; xp: number }[]
  xp: number
}

export function grantAchievements(
  state: AppState,
  ids: AchievementId[],
  at: number,
): AchievementGrant {
  if (ids.length === 0) return { state, unlocked: [], xp: 0 }
  const achievements = { ...state.rewards.achievements }
  const unlocked: { id: AchievementId; title: string; xp: number }[] = []
  let xp = 0
  for (const id of ids) {
    if (achievements[id] != null) continue
    achievements[id] = at
    const def = ACHIEVEMENT_BY_ID[id]
    unlocked.push({ id, title: def.title, xp: def.xp })
    xp += def.xp
  }
  return {
    state: { ...state, rewards: { ...state.rewards, achievements } },
    unlocked,
    xp,
  }
}

/* ---------- totals & helpers ---------- */

export function lifetimeStaked(state: AppState): number {
  return state.rounds.reduce((sum, r) => sum + r.stake, 0)
}

export function netCredits(state: AppState): number {
  return state.rounds.reduce((sum, r) => sum + r.net, 0)
}
