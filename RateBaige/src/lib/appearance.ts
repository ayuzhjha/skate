/* ------------------------------------------------------------------
   VANTA — cosmetic option data (avatars, themes).
   Data only, so the component module stays component-only.
   ------------------------------------------------------------------ */

import type { AvatarId, ThemeId } from './types.ts'

export type AvatarOption = { id: AvatarId; label: string; a: string; b: string }

export const AVATAR_OPTIONS: AvatarOption[] = [
  { id: 'vanta', label: 'Vanta', a: '#c7a568', b: '#7d6a3f' },
  { id: 'comet', label: 'Comet', a: '#e0cf9f', b: '#9d8a55' },
  { id: 'fox', label: 'Fox', a: '#c47a72', b: '#8a4f47' },
  { id: 'heron', label: 'Heron', a: '#cdd6c4', b: '#7c8a72' },
  { id: 'lynx', label: 'Lynx', a: '#b8b2a4', b: '#6f6a5f' },
  { id: 'orbit', label: 'Orbit', a: '#a9b6c4', b: '#5f6c7a' },
]

export type ThemeOption = { value: ThemeId; label: string; swatch: string }

export const THEME_OPTIONS: ThemeOption[] = [
  { value: 'obsidian', label: 'Obsidian', swatch: '#20251f' },
  { value: 'jade', label: 'Jade', swatch: '#1b2a24' },
  { value: 'oxblood', label: 'Oxblood', swatch: '#2a1e1d' },
]
