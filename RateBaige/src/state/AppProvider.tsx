/* ------------------------------------------------------------------
   VANTA — application store.

   A single reducer over `AppState`. All credit/reward maths is
   delegated to the pure functions in `lib/economy.ts`, so the reducer
   stays thin and every mutation is atomic and replay-safe.

   Persistence is handled by the prototype store in `lib/storage.ts`
   (localStorage). See the warning there: this is NOT a security
   boundary.
   ------------------------------------------------------------------ */

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type {
  AchievementId,
  AppState,
  IconName,
  MissionId,
  Player,
  Settings,
  TxnType,
} from '../lib/types'
import { LEVEL_UP_BONUS, XP_DAILY, XP_MISSION, levelFromXp } from '../lib/config'
import {
  addXp,
  allMissionStatus,
  applyMissionEvent,
  claimDaily,
  claimMission,
  claimRefill,
  createInitialState,
  credit,
  dailyStatus,
  evaluateAchievements,
  grantAchievements,
  recordRound,
  refillStatus,
  type RoundInput,
} from '../lib/economy'
import { computeStats } from '../lib/stats'
import { createPrototypeStore } from '../lib/storage'
import { createFeedback } from '../lib/feedback'
import { uid } from '../lib/uid'
import {
  AppContext,
  type AppContextValue,
  type SettleInput,
  type Toast,
} from './AppContext'

/* ---------- reducer ---------- */

type Action =
  | { type: 'credit'; id: string; at: number; txn: TxnType; amount: number; label: string; note?: string; icon: IconName; roundId?: string }
  | { type: 'settle'; at: number; payoutId: string; round: RoundInput; won: boolean; reached21: boolean; xp: number }
  | { type: 'claim-daily'; id: string; at: number }
  | { type: 'claim-refill'; id: string; at: number }
  | { type: 'claim-mission'; id: string; at: number; mission: MissionId }
  | { type: 'grant-achievements'; ids: AchievementId[]; at: number }
  | { type: 'update-player'; patch: Partial<Player> }
  | { type: 'update-settings'; patch: Partial<Settings> }
  | { type: 'ensure-day'; now: number }
  | { type: 'reset'; at: number }

/** Central XP path: adds XP and, on a level-up, credits the bonus once. */
function withXp(state: AppState, amount: number, at: number): AppState {
  const { state: next, leveledUp, level } = addXp(state, amount)
  if (!leveledUp) return next
  const res = credit(next, {
    id: `tx-level-${level}`,
    at,
    type: 'levelup',
    amount: LEVEL_UP_BONUS,
    label: `Level ${level} reward`,
    note: 'Progression bonus',
    icon: 'up',
  })
  return res.state
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'credit': {
      const res = credit(state, {
        id: action.id,
        at: action.at,
        type: action.txn,
        amount: action.amount,
        label: action.label,
        note: action.note,
        icon: action.icon,
        roundId: action.roundId,
      })
      return res.state
    }
    case 'settle': {
      let s = state
      if (action.round.payout > 0) {
        const res = credit(s, {
          id: action.payoutId,
          at: action.at,
          type: 'payout',
          amount: action.round.payout,
          label: 'Blackjack result',
          note: action.round.detail,
          icon: 'coin',
          roundId: action.round.id,
        })
        s = res.state
      }
      s = recordRound(s, action.round)
      s = applyMissionEvent(
        s,
        { kind: 'round', won: action.won, reached21: action.reached21, wager: action.round.stake },
        action.at,
      )
      s = withXp(s, action.xp, action.at)
      return s
    }
    case 'claim-daily': {
      const res = claimDaily(state, { id: action.id, at: action.at })
      if (!res.ok) return state
      let s = applyMissionEvent(res.state, { kind: 'daily' }, action.at)
      s = withXp(s, XP_DAILY, action.at)
      return s
    }
    case 'claim-refill': {
      const res = claimRefill(state, { id: action.id, at: action.at })
      return res.state
    }
    case 'claim-mission': {
      const res = claimMission(state, action.mission, { id: action.id, at: action.at })
      if (!res.ok) return state
      return withXp(res.state, XP_MISSION, action.at)
    }
    case 'grant-achievements': {
      const grant = grantAchievements(state, action.ids, action.at)
      return withXp(grant.state, grant.xp, action.at)
    }
    case 'update-player':
      return { ...state, player: { ...state.player, ...action.patch } }
    case 'update-settings':
      return {
        ...state,
        player: {
          ...state.player,
          settings: { ...state.player.settings, ...action.patch },
        },
      }
    case 'ensure-day':
      return applyMissionEvent(state, { kind: 'round', won: false, reached21: false, wager: 0 }, action.now)
    case 'reset':
      return createInitialState(action.at)
    default:
      return state
  }
}

/* ---------- provider ---------- */

export function AppProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createPrototypeStore())

  const [state, dispatch] = useReducer(reducer, undefined, () => store.load().state)

  const [toasts, setToasts] = useState<Toast[]>([])
  const [now, setNow] = useState(() => Date.now())

  /* Persist on every change (prototype only). */
  useEffect(() => {
    store.save(state)
  }, [store, state])

  /* Keep a 15s clock for countdowns and day-boundary refreshes. */
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 15000)
    return () => window.clearInterval(t)
  }, [])

  /* Roll daily missions over shortly after midnight. */
  useEffect(() => {
    dispatch({ type: 'ensure-day', now: Date.now() })
  }, [])

  /* Growth is a side effect of state: grant newly-qualified achievements. */
  useEffect(() => {
    const ids = evaluateAchievements(state)
    if (ids.length > 0) {
      dispatch({ type: 'grant-achievements', ids, at: Date.now() })
    }
  }, [state])

  const level = useMemo(() => levelFromXp(state.player.xp), [state.player.xp])
  const stats = useMemo(() => computeStats(state.rounds), [state.rounds])
  const daily = useMemo(() => dailyStatus(state, now), [state, now])
  const refill = useMemo(() => refillStatus(state, now), [state, now])
  const missions = useMemo(() => allMissionStatus(state), [state])

  const settings = state.player.settings
  const prefersReduced =
    settings.motion === 'reduced' ||
    (settings.motion === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true)
  const reducedMotion = prefersReduced

  /* Reflect theme + motion on the document for CSS to consume. */
  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = settings.theme
    root.dataset.motion = reducedMotion ? 'reduced' : 'full'
  }, [settings.theme, reducedMotion])

  /* One feedback object for the app's lifetime; kept in sync below. */
  const [feedback] = useState(() => createFeedback())
  useEffect(() => {
    feedback.setEnabled(settings.sound, settings.haptics)
  }, [feedback, settings.sound, settings.haptics])

  const notify = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = uid('toast')
    setToasts((list) => [...list.slice(-2), { ...toast, id }])
    window.setTimeout(() => {
      setToasts((list) => list.filter((t) => t.id !== id))
    }, 4200)
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  /* Level-up toast, driven by comparing the derived level. */
  const lastLevel = useRef(level.level)
  useEffect(() => {
    if (level.level > lastLevel.current) {
      notify({
        title: `Level ${level.level}`,
        body: `${LEVEL_UP_BONUS} VC progression bonus`,
        tone: 'gold',
        icon: 'up',
        amount: LEVEL_UP_BONUS,
      })
      feedback.play('claim')
    }
    lastLevel.current = level.level
  }, [level.level, notify, feedback])

  const placeStake = (amount: number, note: string, roundId: string): boolean => {
    if (amount <= 0) return true
    dispatch({
      type: 'credit',
      id: uid('stake'),
      at: Date.now(),
      txn: 'stake',
      amount: -Math.round(amount),
      label: 'Blackjack stake',
      note,
      icon: 'chip',
      roundId,
    })
    return true
  }

  const settle = (input: SettleInput) => {
    dispatch({
      type: 'settle',
      at: input.at,
      payoutId: uid('payout'),
      won: input.won,
      reached21: input.reached21,
      xp: input.xp,
      round: {
        id: input.roundId,
        at: input.at,
        game: 'blackjack',
        stake: input.stake,
        payout: input.payout,
        result: input.result,
        detail: input.detail,
        playerTotal: input.playerTotal,
        dealerTotal: input.dealerTotal,
        hands: input.hands,
      },
    })
  }

  const claimDailyReward = () => {
    dispatch({ type: 'claim-daily', id: uid('daily'), at: Date.now() })
  }

  const claimFreeRefill = () => {
    dispatch({ type: 'claim-refill', id: uid('refill'), at: Date.now() })
  }

  const claimMissionReward = (id: MissionId) => {
    dispatch({ type: 'claim-mission', id: uid('mission'), at: Date.now(), mission: id })
  }

  const updatePlayer = (patch: Partial<Player>) => {
    dispatch({ type: 'update-player', patch })
  }

  const updateSettings = (patch: Partial<Settings>) => {
    dispatch({ type: 'update-settings', patch })
  }

  const resetProgress = () => {
    dispatch({ type: 'reset', at: Date.now() })
  }

  const value: AppContextValue = {
    state,
    level,
    stats,
    daily,
    refill,
    missions,
    toasts,
    now,
    reducedMotion,
    feedback,
    placeStake,
    settle,
    claimDailyReward,
    claimFreeRefill,
    claimMissionReward,
    updatePlayer,
    updateSettings,
    resetProgress,
    notify,
    dismissToast,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
