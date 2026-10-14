/* ------------------------------------------------------------------
   VANTA — domain models
   Pure type declarations. No runtime code, so this file is safe to
   erase during type-stripping (used by the engine test harness).
   ------------------------------------------------------------------ */

export type GameId = 'blackjack' | 'roulette' | 'poker' | 'slots'

export type ThemeId = 'obsidian' | 'jade' | 'oxblood'

export type MotionPref = 'system' | 'reduced' | 'full'

export type AvatarId = 'vanta' | 'comet' | 'fox' | 'heron' | 'lynx' | 'orbit'

/** Every glyph the interface can render. */
export type IconName =
  | 'spark'
  | 'check'
  | 'chip'
  | 'coin'
  | 'flag'
  | 'info'
  | 'trophy'
  | 'up'
  | 'down'
  | 'gift'
  | 'flame'
  | 'target'
  | 'home'
  | 'cards'
  | 'play'
  | 'stats'
  | 'user'
  | 'settings'
  | 'bell'
  | 'sound'
  | 'haptic'
  | 'moon'
  | 'chevron'
  | 'close'
  | 'trash'
  | 'lock'
  | 'shield'
  | 'book'
  | 'question'
  | 'arrow-right'
  | 'refresh'
  | 'plus'
  | 'minus'
  | 'history'
  | 'wallet'

export type TxnType =
  | 'starting'
  | 'daily'
  | 'streak'
  | 'mission'
  | 'achievement'
  | 'levelup'
  | 'refill'
  | 'stake'
  | 'payout'
  | 'refund'
  | 'adjustment'

/** A single, immutable credit movement. `amount` is signed. */
export type Transaction = {
  id: string
  type: TxnType
  amount: number
  balanceAfter: number
  at: number
  label: string
  note?: string
  roundId?: string
  icon: IconName
}

export type RoundResult = 'win' | 'loss' | 'push' | 'blackjack' | 'bust'

/** One settled game round, used for history and statistics. */
export type Round = {
  id: string
  game: GameId
  at: number
  /** Total credits wagered across the round (includes doubles/splits). */
  stake: number
  /** Gross credits returned (stake + winnings). 0 on a loss. */
  payout: number
  /** payout − stake */
  net: number
  result: RoundResult
  detail: string
  playerTotal: number
  dealerTotal: number
  hands: number
}

export type Notifications = {
  daily: boolean
  rewards: boolean
  results: boolean
}

export type Settings = {
  sound: boolean
  haptics: boolean
  motion: MotionPref
  theme: ThemeId
  notifications: Notifications
}

export type Player = {
  id: string
  name: string
  avatar: AvatarId
  createdAt: number
  /** Lifetime XP. Level is derived from this. */
  xp: number
  settings: Settings
}

export type MissionId = 'play3' | 'win2' | 'wager300' | 'hit21' | 'claimDaily'

export type MissionProgress = {
  progress: number
  claimedAt: number | null
}

export type AchievementId =
  | 'firstRound'
  | 'firstWin'
  | 'natural'
  | 'tenRounds'
  | 'bigStake'
  | 'streak3'
  | 'streak7'
  | 'level5'
  | 'splitWin'
  | 'push'
  | 'daily10'
  | 'century'

export type RewardState = {
  /** Local calendar days (YYYY-MM-DD) the daily reward was claimed. */
  dailyClaims: string[]
  lastDailyAt: number | null
  /** Consecutive-day streak length as of the last claim. */
  streak: number
  /** Epoch ms of the last free top-up claim, or null. */
  refillAt: number | null
  /** Calendar day the current mission set belongs to. */
  missionsDate: string
  missions: Record<MissionId, MissionProgress>
  achievements: Partial<Record<AchievementId, number>>
}

export type AppState = {
  version: number
  player: Player
  balance: number
  transactions: Transaction[]
  rounds: Round[]
  rewards: RewardState
}
