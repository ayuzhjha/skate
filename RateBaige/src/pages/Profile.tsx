/* ------------------------------------------------------------------
   VANTA — Profile.
   Identity, progression, personal statistics, and the entry points to
   settings, help and legal screens.
   ------------------------------------------------------------------ */

import { useState } from 'react'
import { Icon } from '../components/Icon'
import { SiteFooter } from '../components/SiteFooter'
import { TopNav } from '../components/TopNav'
import {
  Avatar,
  Button,
  Modal,
  Panel,
  PanelHead,
  ProgressBar,
  Stat,
} from '../components/ui'
import { AVATAR_OPTIONS } from '../lib/appearance'
import { ACHIEVEMENTS } from '../lib/config'
import { formatCredits, formatDelta, percent } from '../lib/format'
import { useApp } from '../state/AppContext'
import type { AvatarId } from '../lib/types'

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || 'V'
}

const LINKS = [
  { href: '#/settings', label: 'Settings', icon: 'settings', detail: 'Sound, haptics, theme' },
  { href: '#/how-to-play', label: 'How to Play', icon: 'book', detail: 'Blackjack rules and controls' },
  { href: '#/faq', label: 'FAQ', icon: 'question', detail: 'Common questions' },
  { href: '#/privacy', label: 'Privacy Policy', icon: 'shield', detail: 'How your data is handled' },
  { href: '#/terms', label: 'Terms of Service', icon: 'lock', detail: 'The rules of play' },
] as const

export function Profile() {
  const { state, level, stats, updatePlayer, notify, feedback } = useApp()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(state.player.name)
  const [avatar, setAvatar] = useState<AvatarId>(state.player.avatar)

  const unlocked = Object.keys(state.rewards.achievements).length

  const saveIdentity = () => {
    const clean = name.trim().slice(0, 24) || 'Guest'
    updatePlayer({ name: clean, avatar })
    setEditing(false)
    feedback.play('tap')
    notify({ title: 'Profile updated', tone: 'plain', icon: 'user' })
  }

  const openEditor = () => {
    setName(state.player.name)
    setAvatar(state.player.avatar)
    setEditing(true)
    feedback.play('tap')
  }

  return (
    <>
      <TopNav active="profile" />

      <main className="page">
        <div className="shell">
          <div className="grid-12 page__grid">
            <Panel className="profile-card panel--felt g-span-7">
              <div className="profile-card__top">
                <Avatar
                  id={state.player.avatar}
                  initials={initialsOf(state.player.name)}
                  size={72}
                />
                <div className="profile-card__id">
                  <h1 className="title-lg">{state.player.name}</h1>
                  <p className="profile-card__sub">
                    Level {level.level} · Guest since{' '}
                    {new Date(state.player.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <Button variant="outline" size="sm" icon="user" onClick={openEditor}>
                  Edit
                </Button>
              </div>

              <div className="profile-card__xp">
                <div className="profile-card__xp-row">
                  <span className="eyebrow eyebrow--muted">
                    {level.intoLevel} / {level.needed} XP
                  </span>
                  <span className="eyebrow eyebrow--muted">Level {level.level + 1}</span>
                </div>
                <ProgressBar
                  value={level.intoLevel}
                  max={level.needed}
                  label="Experience to next level"
                />
              </div>
            </Panel>

            <Panel className="profile-balance g-span-5">
              <PanelHead eyebrow="Balance" title="Virtual credits" />
              <p className="profile-balance__value num">
                {formatCredits(state.balance)}
                <span className="profile-balance__unit">VC</span>
              </p>
              <p className="profile-balance__note">
                Free virtual credits. No monetary value. Not redeemable.
              </p>
              <a className="btn btn--gold btn--sm" href="#/credits">
                Credits & activity
              </a>
            </Panel>

            <Panel className="g-span-12" as="section">
              <PanelHead
                eyebrow="Your play"
                title="Statistics"
                action={
                  <a className="link" href="#/stats">
                    Full dashboard →
                  </a>
                }
              />
              <div className="stat-grid">
                <Stat label="Rounds" value={stats.played} />
                <Stat label="Won" value={stats.wins} tone="gold" />
                <Stat label="Lost" value={stats.losses} tone="red" />
                <Stat label="Pushed" value={stats.pushes} />
                <Stat label="Win rate" value={percent(stats.winRate)} />
                <Stat
                  label="Net credits"
                  value={formatDelta(stats.net)}
                  tone={stats.net >= 0 ? 'gold' : 'red'}
                />
              </div>
            </Panel>

            <Panel className="g-span-7" as="section">
              <PanelHead
                eyebrow="Lifetime"
                title={`${unlocked} of ${ACHIEVEMENTS.length} achievements`}
                action={
                  <a className="link" href="#/rewards">
                    View all →
                  </a>
                }
              />
              <div className="profile-badges">
                {ACHIEVEMENTS.slice(0, 8).map((a) => {
                  const got = state.rewards.achievements[a.id] != null
                  return (
                    <span
                      key={a.id}
                      className={`profile-badge${got ? ' is-unlocked' : ''}`}
                      title={`${a.title} — ${a.detail}`}
                    >
                      <Icon name={got ? a.icon : 'lock'} size={17} />
                    </span>
                  )
                })}
              </div>
            </Panel>

            <nav className="profile-links g-span-5" aria-label="Profile sections">
              {LINKS.map((l) => (
                <a key={l.href} className="profile-link" href={l.href}>
                  <span className="profile-link__icon" aria-hidden="true">
                    <Icon name={l.icon} size={18} />
                  </span>
                  <span className="profile-link__text">
                    <span className="profile-link__label">{l.label}</span>
                    <span className="profile-link__detail">{l.detail}</span>
                  </span>
                  <Icon name="chevron" size={16} />
                </a>
              ))}
            </nav>
          </div>
        </div>
      </main>

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title="Edit profile"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button variant="gold" onClick={saveIdentity}>
              Save
            </Button>
          </>
        }
      >
        <label className="field">
          <span className="field__label">Display name</span>
          <input
            className="field__input"
            value={name}
            maxLength={24}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </label>

        <fieldset className="field">
          <legend className="field__label">Avatar</legend>
          <div className="avatar-picker">
            {AVATAR_OPTIONS.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`avatar-picker__item${a.id === avatar ? ' is-active' : ''}`}
                onClick={() => setAvatar(a.id)}
                aria-pressed={a.id === avatar}
                aria-label={a.label}
              >
                <Avatar id={a.id} size={44} />
              </button>
            ))}
          </div>
        </fieldset>
      </Modal>

      <SiteFooter />
    </>
  )
}
