/* ------------------------------------------------------------------
   VANTA — Settings.
   Audio, haptics, motion, theme and notification preferences, plus
   help/legal entry points and a confirmed progress reset.
   ------------------------------------------------------------------ */

import { useState } from 'react'
import { Icon } from '../components/Icon'
import { SiteFooter } from '../components/SiteFooter'
import { TopNav } from '../components/TopNav'
import {
  Button,
  Modal,
  Panel,
  PanelHead,
  Segmented,
  Toggle,
} from '../components/ui'
import { THEME_OPTIONS } from '../lib/appearance'
import { useApp } from '../state/AppContext'
import type { MotionPref } from '../lib/types'

const RESOURCE_LINKS = [
  { href: '#/how-to-play', label: 'How to Play', icon: 'book' },
  { href: '#/faq', label: 'FAQ', icon: 'question' },
  { href: '#/privacy', label: 'Privacy Policy', icon: 'shield' },
  { href: '#/terms', label: 'Terms of Service', icon: 'lock' },
] as const

export function Settings() {
  const { state, updateSettings, resetProgress, notify, feedback } = useApp()
  const s = state.player.settings
  const [confirming, setConfirming] = useState(false)

  const hapticsSupported =
    typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'

  const setMotion = (motion: MotionPref) => {
    updateSettings({ motion })
    feedback.play('tap')
  }

  const setTheme = (theme: typeof s.theme) => {
    updateSettings({ theme })
    feedback.play('tap')
  }

  const doReset = () => {
    resetProgress()
    setConfirming(false)
    notify({
      title: 'Progress reset',
      body: 'Your guest account has been restored to 2,500 VC.',
      tone: 'plain',
      icon: 'refresh',
    })
    window.location.hash = '#/'
  }

  return (
    <>
      <TopNav active="settings" />

      <main className="page">
        <div className="shell">
          <div className="grid-12 page__grid">
            <div className="g-1-8">
              <p className="eyebrow">Settings</p>
              <h1 className="title-lg page__headline">Make it yours.</h1>
            </div>
            <p className="hero__note g-9-12">
              Preferences are stored on this device and applied everywhere in the
              app.
            </p>

            <Panel className="g-span-6" as="section">
              <PanelHead eyebrow="Feedback" title="Sound & haptics" />
              <div className="setting-list">
                <Toggle
                  label="Sound effects"
                  hint="Subtle tones for deals, wins and claims"
                  icon="sound"
                  checked={s.sound}
                  onChange={(v) => {
                    updateSettings({ sound: v })
                    if (v) feedback.play('tap')
                  }}
                />
                <Toggle
                  label="Haptic feedback"
                  hint={
                    hapticsSupported
                      ? 'Short vibrations on supported devices'
                      : 'Not supported on this device'
                  }
                  icon="haptic"
                  checked={s.haptics && hapticsSupported}
                  disabled={!hapticsSupported}
                  onChange={(v) => {
                    updateSettings({ haptics: v })
                    feedback.play('tap')
                  }}
                />
              </div>
            </Panel>

            <Panel className="g-span-6" as="section">
              <PanelHead eyebrow="Motion" title="Animation" />
              <div className="setting-list">
                <div className="setting-row">
                  <span className="setting-row__text">
                    <span className="setting-row__label">Reduce motion</span>
                    <span className="setting-row__hint">
                      Limits card animations and transitions
                    </span>
                  </span>
                </div>
                <Segmented
                  label="Motion preference"
                  value={s.motion}
                  onChange={setMotion}
                  options={[
                    { value: 'system', label: 'System' },
                    { value: 'full', label: 'Full' },
                    { value: 'reduced', label: 'Reduced' },
                  ]}
                />
              </div>
            </Panel>

            <Panel className="g-span-6" as="section">
              <PanelHead eyebrow="Appearance" title="Theme" />
              <div className="theme-picker">
                {THEME_OPTIONS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    className={`theme-swatch${s.theme === t.value ? ' is-active' : ''}`}
                    onClick={() => setTheme(t.value)}
                    aria-pressed={s.theme === t.value}
                  >
                    <span className="theme-swatch__chip" style={{ background: t.swatch }} />
                    <span className="theme-swatch__label">{t.label}</span>
                    {s.theme === t.value && <Icon name="check" size={15} />}
                  </button>
                ))}
              </div>
            </Panel>

            <Panel className="g-span-6" as="section">
              <PanelHead eyebrow="Alerts" title="Notifications" />
              <div className="setting-list">
                <Toggle
                  label="Daily reward reminders"
                  hint="A nudge when your daily credits are ready"
                  icon="bell"
                  checked={s.notifications.daily}
                  onChange={(v) =>
                    updateSettings({ notifications: { ...s.notifications, daily: v } })
                  }
                />
                <Toggle
                  label="Reward & mission alerts"
                  hint="When a mission completes or a badge unlocks"
                  icon="trophy"
                  checked={s.notifications.rewards}
                  onChange={(v) =>
                    updateSettings({ notifications: { ...s.notifications, rewards: v } })
                  }
                />
                <Toggle
                  label="Round results"
                  hint="A summary after each settled hand"
                  icon="cards"
                  checked={s.notifications.results}
                  onChange={(v) =>
                    updateSettings({ notifications: { ...s.notifications, results: v } })
                  }
                />
              </div>
            </Panel>

            <Panel className="g-span-12" as="section">
              <PanelHead eyebrow="Help" title="Support & legal" />
              <nav className="resource-links" aria-label="Help and legal">
                {RESOURCE_LINKS.map((l) => (
                  <a key={l.href} className="resource-link" href={l.href}>
                    <span className="resource-link__icon" aria-hidden="true">
                      <Icon name={l.icon} size={18} />
                    </span>
                    <span>{l.label}</span>
                    <Icon name="chevron" size={16} />
                  </a>
                ))}
              </nav>
            </Panel>

            <Panel className="g-span-12 danger-panel" as="section">
              <PanelHead eyebrow="Danger zone" title="Reset guest progress" />
              <p className="danger-panel__note">
                This clears your balance, history, statistics, rewards and
                achievements on this device, and restores a fresh 2,500 VC guest
                account. This cannot be undone.
              </p>
              <Button variant="danger" icon="trash" onClick={() => setConfirming(true)}>
                Reset progress
              </Button>
            </Panel>
          </div>
        </div>
      </main>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Reset guest progress?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Keep my progress
            </Button>
            <Button variant="danger" icon="trash" onClick={doReset}>
              Reset everything
            </Button>
          </>
        }
      >
        <p className="modal__text">
          You are about to erase all local progress for this guest account —
          balance, rounds, statistics, rewards and achievements. This action
          cannot be undone.
        </p>
      </Modal>

      <SiteFooter />
    </>
  )
}
