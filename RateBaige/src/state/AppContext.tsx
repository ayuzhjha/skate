/* ------------------------------------------------------------------
   VANTA — application context.

   This module deliberately exports no components: it holds the
   context object, the `useApp` hook and the shared types. The provider
   (and the reducer it drives) live in `AppProvider.tsx`, so that file
   only exports a component and fast-refresh stays happy.
   ------------------------------------------------------------------ */

import { createContext, useContext } from 'react'
import type {
  AppState,
  IconName,
  MissionId,
  Player,
  Settings,
} from '../lib/types'
import type { LevelInfo } from '../lib/config'
import { type DailyStatus, type MissionStatus, type RefillStatus, type RoundInput } from '../lib/economy'
import type { Stats } from '../lib/stats'
import type { Feedback } from '../lib/feedback'

/* ---------- toasts ---------- */

export type ToastTone = 'gold' | 'red' | 'plain'

export type Toast = {
  id: string
  title: string
  body?: string
  tone: ToastTone
  icon: IconName
  amount?: number
}

export type SettleInput = {
  roundId: string
  at: number
  stake: number
  payout: number
  result: RoundInput['result']
  detail: string
  playerTotal: number
  dealerTotal: number
  hands: number
  won: boolean
  reached21: boolean
  xp: number
}

export type AppContextValue = {
  state: AppState
  level: LevelInfo
  stats: Stats
  daily: DailyStatus
  refill: RefillStatus
  missions: MissionStatus[]
  toasts: Toast[]
  now: number
  reducedMotion: boolean
  feedback: Feedback
  placeStake: (amount: number, note: string, roundId: string) => boolean
  settle: (input: SettleInput) => void
  claimDailyReward: () => void
  claimFreeRefill: () => void
  claimMissionReward: (id: MissionId) => void
  updatePlayer: (patch: Partial<Player>) => void
  updateSettings: (patch: Partial<Settings>) => void
  resetProgress: () => void
  notify: (toast: Omit<Toast, 'id'>) => void
  dismissToast: (id: string) => void
}

export const AppContext = createContext<AppContextValue | null>(null)

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}

export type { LevelInfo, Stats, DailyStatus, RefillStatus, MissionStatus }
