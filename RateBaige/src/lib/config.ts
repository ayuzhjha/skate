/* ------------------------------------------------------------------
   VANTA — tunable economy, progression and betting configuration.
   Everything a designer might want to change lives here.
   ------------------------------------------------------------------ */

import type { AchievementId, GameId, IconName, MissionId } from './types'

export const STORAGE_KEY = 'vanta.state.v1'
export const SCHEMA_VERSION = 1

/* ---------- credits ---------- */

/** New guests start with this many virtual credits. */
export const STARTING_BALANCE = 2500

/** Betting limits for the table games. */
export const MIN_BET = 10
export const MAX_BET = 500

/** Selectable chip denominations, ascending. */
export const CHIPS = [10, 25, 50, 100, 250, 500] as const

/* ---------- daily reward & streak ---------- */

export const DAILY_BASE = 250
export const DAILY_STREAK_STEP = 50
export const DAILY_STREAK_MAX_DAYS = 7

/** Credits granted for a claim on day `day` of a streak (1-based). */
export function dailyRewardFor(day: number): number {
  const step = Math.max(0, Math.min(day, DAILY_STREAK_MAX_DAYS) - 1)
  return DAILY_BASE + step * DAILY_STREAK_STEP
}

/* ---------- low-balance refill ---------- */

export const REFILL_THRESHOLD = 100
export const REFILL_AMOUNT = 500
export const REFILL_COOLDOWN_MS = 12 * 60 * 60 * 1000

/* ---------- progression ---------- */

/** XP required to advance from `level` to `level + 1`. */
export function xpForLevel(level: number): number {
  return 100 + (level - 1) * 60
}

export const XP_ROUND = 8
export const XP_WIN_BONUS = 6
export const XP_BLACKJACK_BONUS = 14
export const XP_DAILY = 15
export const XP_MISSION = 20
export const LEVEL_UP_BONUS = 100

export type LevelInfo = {
  level: number
  intoLevel: number
  needed: number
  progress: number
  totalXp: number
}

/** Derive level + progress from a lifetime XP total. */
export function levelFromXp(totalXp: number): LevelInfo {
  let level = 1
  let remaining = Math.max(0, Math.floor(totalXp))
  let needed = xpForLevel(level)
  while (remaining >= needed) {
    remaining -= needed
    level += 1
    needed = xpForLevel(level)
  }
  return {
    level,
    intoLevel: remaining,
    needed,
    progress: needed > 0 ? remaining / needed : 0,
    totalXp: Math.floor(totalXp),
  }
}

/* ---------- games catalogue ---------- */

export type GameDef = {
  id: GameId
  title: string
  status: 'available' | 'soon'
  tagline: string
  description: string
  category: string
  minBet?: number
  maxBet?: number
}

export const GAMES: GameDef[] = [
  {
    id: 'blackjack',
    title: 'Blackjack',
    status: 'available',
    tagline: 'Beat the dealer to 21.',
    description:
      'One hand against the dealer. Place a virtual stake, then take your cards at your own pace.',
    category: 'Cards',
    minBet: MIN_BET,
    maxBet: MAX_BET,
  },
  {
    id: 'roulette',
    title: 'Roulette',
    status: 'soon',
    tagline: 'A single-zero wheel.',
    description: 'A single-zero wheel, quietly paced.',
    category: 'Table',
  },
  {
    id: 'poker',
    title: 'Poker',
    status: 'soon',
    tagline: 'Five-card draw.',
    description: 'Five-card draw at your own pace.',
    category: 'Cards',
  },
  {
    id: 'slots',
    title: 'Slots',
    status: 'soon',
    tagline: 'Three reels, one pull.',
    description: 'A restrained three-reel cabinet. Coming later.',
    category: 'Reels',
  },
]

/* ---------- missions ---------- */

export type MissionDef = {
  id: MissionId
  title: string
  detail: string
  target: number
  reward: number
}

export const MISSIONS: MissionDef[] = [
  {
    id: 'play3',
    title: 'Take a seat',
    detail: 'Play 3 rounds today',
    target: 3,
    reward: 100,
  },
  {
    id: 'win2',
    title: 'On a run',
    detail: 'Win 2 rounds today',
    target: 2,
    reward: 150,
  },
  {
    id: 'wager300',
    title: 'Back the table',
    detail: 'Wager 300 VC today',
    target: 300,
    reward: 200,
  },
  {
    id: 'hit21',
    title: 'Twenty-one',
    detail: 'Reach 21 in a round',
    target: 1,
    reward: 75,
  },
  {
    id: 'claimDaily',
    title: 'Punctual',
    detail: 'Claim your daily reward',
    target: 1,
    reward: 50,
  },
]

/* ---------- achievements ---------- */

export type AchievementDef = {
  id: AchievementId
  title: string
  detail: string
  icon: IconName
  xp: number
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'firstRound', title: 'First deal', detail: 'Play your first round', icon: 'cards', xp: 10 },
  { id: 'firstWin', title: 'First win', detail: 'Win a round', icon: 'trophy', xp: 15 },
  { id: 'natural', title: 'Natural', detail: 'Draw a blackjack', icon: 'spark', xp: 30 },
  { id: 'tenRounds', title: 'Regular', detail: 'Play 10 rounds', icon: 'chip', xp: 25 },
  { id: 'century', title: 'Seasoned', detail: 'Play 100 rounds', icon: 'flame', xp: 100 },
  { id: 'bigStake', title: 'High stake', detail: 'Stake 500 VC in one round', icon: 'coin', xp: 40 },
  { id: 'splitWin', title: 'Split master', detail: 'Win a round after splitting', icon: 'target', xp: 35 },
  { id: 'push', title: 'Dead heat', detail: 'Push a hand against the dealer', icon: 'shield', xp: 15 },
  { id: 'streak3', title: 'Three in a row', detail: 'Claim 3 days in a row', icon: 'flame', xp: 30 },
  { id: 'streak7', title: 'Full week', detail: 'Claim 7 days in a row', icon: 'gift', xp: 60 },
  { id: 'daily10', title: 'Devoted', detail: 'Claim the daily reward 10 times', icon: 'check', xp: 50 },
  { id: 'level5', title: 'Rising', detail: 'Reach level 5', icon: 'up', xp: 0 },
]

export const ACHIEVEMENT_BY_ID: Record<AchievementId, AchievementDef> =
  Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a])) as Record<
    AchievementId,
    AchievementDef
  >

export const MISSION_BY_ID: Record<MissionId, MissionDef> = Object.fromEntries(
  MISSIONS.map((m) => [m.id, m]),
) as Record<MissionId, MissionDef>
