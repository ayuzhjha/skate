/* ------------------------------------------------------------------
   VANTA — persistence.

   ⚠️  PROTOTYPE STORAGE. This is a local, client-side persistence
   layer used to demonstrate the product end-to-end without a backend.
   localStorage is NOT secure and NOT tamper-proof: anyone with access
   to the device can read and edit it. Balances, transactions and
   reward claims must be validated server-side before this model is
   trusted with anything of value.

   The `Store` interface is the seam where a real API client would
   drop in: swap `createPrototypeStore()` for one that talks to a
   server and the rest of the app is unchanged.
   ------------------------------------------------------------------ */

import type { AppState } from './types.ts'
import { SCHEMA_VERSION, STORAGE_KEY } from './config.ts'
import { createInitialState, defaultPlayer, freshRewards } from './economy.ts'
import { dayKey } from './format.ts'

export interface KeyValueStore {
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
}

export class LocalStorageStore implements KeyValueStore {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key)
    } catch {
      return null
    }
  }
  set(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value)
    } catch {
      /* quota or private-mode: fall back to memory-only for the session */
    }
  }
  remove(key: string): void {
    try {
      window.localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  }
}

export class MemoryStore implements KeyValueStore {
  private map = new Map<string, string>()
  get(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null
  }
  set(key: string, value: string): void {
    this.map.set(key, value)
  }
  remove(key: string): void {
    this.map.delete(key)
  }
}

/* ---------- validation / migration ---------- */

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

/**
 * Coerce whatever is in storage into a safe AppState. Unknown or
 * malformed data is replaced with sensible defaults rather than
 * crashing the app.
 */
export function sanitizeState(raw: unknown, now: number): AppState {
  if (!isObject(raw) || raw.version !== SCHEMA_VERSION) {
    return createInitialState(now)
  }
  const base = createInitialState(now)
  const player = isObject(raw.player) ? raw.player : {}
  const settings = isObject(player.settings) ? player.settings : {}
  const notifications = isObject(settings.notifications) ? settings.notifications : {}
  const rewards = isObject(raw.rewards) ? raw.rewards : {}

  const balance = Math.max(0, Math.round(num(raw.balance, base.balance)))

  const state: AppState = {
    version: SCHEMA_VERSION,
    player: {
      ...defaultPlayer(now),
      id: typeof player.id === 'string' ? player.id : 'guest',
      name: typeof player.name === 'string' && player.name.trim() ? player.name : 'Guest',
      avatar: (typeof player.avatar === 'string' ? player.avatar : 'vanta') as never,
      createdAt: num(player.createdAt, now),
      xp: Math.max(0, Math.round(num(player.xp, 0))),
      settings: {
        sound: settings.sound !== false,
        haptics: settings.haptics !== false,
        motion:
          settings.motion === 'reduced' || settings.motion === 'full'
            ? settings.motion
            : 'system',
        theme:
          settings.theme === 'jade' || settings.theme === 'oxblood'
            ? settings.theme
            : 'obsidian',
        notifications: {
          daily: notifications.daily !== false,
          rewards: notifications.rewards !== false,
          results: notifications.results === true,
        },
      },
    },
    balance,
    transactions: Array.isArray(raw.transactions) ? (raw.transactions as never[]) : [],
    rounds: Array.isArray(raw.rounds) ? (raw.rounds as never[]) : [],
    rewards: {
      ...freshRewards(now),
      ...(rewards as object),
      // Always rebuild the mission map so new mission ids appear.
      missions: {
        ...freshRewards(now).missions,
        ...(isObject(rewards.missions) ? (rewards.missions as object) : {}),
      },
      achievements: isObject(rewards.achievements) ? (rewards.achievements as never) : {},
      dailyClaims: Array.isArray(rewards.dailyClaims)
        ? (rewards.dailyClaims as string[])
        : [],
    },
  }
  // Missions belong to a specific day; roll them over if stale.
  if (state.rewards.missionsDate !== dayKey(now)) {
    state.rewards = { ...state.rewards, missionsDate: dayKey(now), missions: freshRewards(now).missions }
  }
  return state
}

/* ---------- prototype store ---------- */

export type LoadResult = {
  state: AppState
  recovered: boolean
}

export interface PersistenceStore {
  load(): LoadResult
  save(state: AppState): void
  clear(): void
}

/** localStorage-backed prototype store. NOT a security boundary. */
export function createPrototypeStore(
  kv: KeyValueStore = new LocalStorageStore(),
  key = STORAGE_KEY,
): PersistenceStore {
  return {
    load() {
      const now = Date.now()
      const raw = kv.get(key)
      if (!raw) return { state: createInitialState(now), recovered: true }
      try {
        return { state: sanitizeState(JSON.parse(raw), now), recovered: false }
      } catch {
        return { state: createInitialState(now), recovered: true }
      }
    },
    save(state) {
      try {
        kv.set(key, JSON.stringify(state))
      } catch {
        /* storage unavailable — session keeps working in memory */
      }
    },
    clear() {
      kv.remove(key)
    },
  }
}
