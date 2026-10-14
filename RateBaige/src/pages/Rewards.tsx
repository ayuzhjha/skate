/* ------------------------------------------------------------------
   VANTA — Rewards.
   Daily claim + streak ladder, free top-up, daily missions, lifetime
   achievements and the level/XP track. Every claim is validated by the
   store, so states are always honest (claimed / available / locked).
   ------------------------------------------------------------------ */

import { CreditCoin } from '../components/art'
import { Icon } from '../components/Icon'
import { SiteFooter } from '../components/SiteFooter'
import { TopNav } from '../components/TopNav'
import { Button, Panel, PanelHead, ProgressBar } from '../components/ui'
import { ACHIEVEMENTS, DAILY_STREAK_MAX_DAYS, XP_MISSION, dailyRewardFor } from '../lib/config'
import { formatCountdown, formatCredits, msUntilNextDay } from '../lib/format'
import { useApp } from '../state/AppContext'

export function Rewards() {
  const {
    state,
    level,
    daily,
    refill,
    missions,
    now,
    claimDailyReward,
    claimFreeRefill,
    claimMissionReward,
    notify,
    feedback,
  } = useApp()

  const achievements = state.rewards.achievements
  const unlocked = Object.keys(achievements).length

  const onDaily = () => {
    if (daily.claimedToday) return
    feedback.play('claim')
    claimDailyReward()
    notify({
      title: 'Daily reward claimed',
      body: `Day ${daily.nextStreak} of your streak`,
      tone: 'gold',
      icon: 'coin',
      amount: daily.amount,
    })
  }

  const onMission = (id: (typeof missions)[number]['id']) => {
    const m = missions.find((x) => x.id === id)
    if (!m || !m.complete || m.claimed) return
    feedback.play('claim')
    claimMissionReward(id)
    notify({
      title: `Mission complete · ${m.title}`,
      body: `+${formatCredits(m.reward)} VC · +${XP_MISSION} XP`,
      tone: 'gold',
      icon: 'target',
      amount: m.reward,
    })
  }

  const onRefill = () => {
    feedback.play('claim')
    claimFreeRefill()
    notify({
      title: 'Free top-up',
      body: 'A little credit to keep playing',
      tone: 'gold',
      icon: 'gift',
      amount: refill.amount,
    })
  }

  return (
    <>
      <TopNav active="rewards" />

      <main className="page">
        <div className="shell">
          <div className="grid-12 page__grid">
            <div className="g-1-8">
              <p className="eyebrow">Rewards</p>
              <h1 className="title-lg page__headline">Keep the streak alive.</h1>
            </div>
            <p className="hero__note g-9-12">
              Claim free virtual credits every day, complete missions, and unlock
              achievements as you play.
            </p>

            <Panel className="panel--felt reward-daily g-span-7">
              <div className="reward-daily__top">
                <div>
                  <p className="eyebrow">Daily reward</p>
                  <p className="daily__amount">
                    <span className="daily__value num">
                      {daily.claimedToday ? '0' : `+${daily.amount}`}
                    </span>
                    <span className="daily__unit">VC</span>
                  </p>
                  <p className="reward-daily__meta">
                    {daily.claimedToday
                      ? 'Claimed today — come back tomorrow.'
                      : `Day ${daily.nextStreak} of your streak.`}
                  </p>
                </div>
                <CreditCoin size={58} />
              </div>

              <ol className="ladder" aria-label="Streak rewards">
                {Array.from({ length: DAILY_STREAK_MAX_DAYS }, (_, i) => {
                  const day = i + 1
                  const claimed = day <= daily.streak
                  const isNext = !daily.claimedToday && day === daily.nextStreak
                  return (
                    <li
                      key={day}
                      className={`ladder__step${claimed ? ' is-claimed' : ''}${
                        isNext ? ' is-next' : ''
                      }`}
                    >
                      <span className="ladder__day">Day {day}</span>
                      <span className="ladder__amt num">{dailyRewardFor(day)}</span>
                    </li>
                  )
                })}
              </ol>

              <div className="reward-daily__actions">
                <Button
                  variant="gold"
                  size="lg"
                  icon={daily.claimedToday ? 'check' : 'gift'}
                  disabled={daily.claimedToday}
                  onClick={onDaily}
                >
                  {daily.claimedToday ? 'Claimed today' : `Claim ${daily.amount} VC`}
                </Button>
                <span className="reward-daily__timer num">
                  Resets in {formatCountdown(msUntilNextDay(now))}
                </span>
              </div>
            </Panel>

            <div className="g-span-5 stack">
              <Panel className="reward-level">
                <PanelHead eyebrow="Progression" title={`Level ${level.level}`} />
                <div className="reward-level__meter">
                  <ProgressBar
                    value={level.intoLevel}
                    max={level.needed}
                    label="Experience to next level"
                  />
                </div>
                <p className="reward-level__note">
                  <b className="num">
                    {level.intoLevel} / {level.needed} XP
                  </b>{' '}
                  to level {level.level + 1}
                </p>
              </Panel>

              <Panel className="reward-total">
                <PanelHead eyebrow="Lifetime" title={`${unlocked} of ${ACHIEVEMENTS.length} badges`} />
                <p className="reward-total__note">
                  Every badge also awards bonus XP toward your next level.
                </p>
                <div className="reward-total__meter">
                  <ProgressBar
                    value={unlocked}
                    max={ACHIEVEMENTS.length}
                    tone="plain"
                    label="Achievements unlocked"
                  />
                </div>
              </Panel>

              {refill.eligible ? (
                <Panel className="panel--felt reward-refill">
                  <PanelHead eyebrow="Low balance" title="Free top-up" />
                  <p className="reward-total__note">
                    Your balance is under 100 VC. Claim a free {refill.amount} VC
                    top-up to keep playing.
                  </p>
                  <Button variant="gold" block icon="gift" onClick={onRefill}>
                    Claim {refill.amount} VC
                  </Button>
                </Panel>
              ) : (
                <Panel className="reward-refill reward-refill--idle">
                  <PanelHead eyebrow="Low balance" title="Free top-up" />
                  <p className="reward-total__note">
                    Available automatically whenever your balance drops below 100
                    VC.
                  </p>
                  <Button variant="outline" block disabled icon="lock">
                    Not needed yet
                  </Button>
                </Panel>
              )}
            </div>

            <Panel className="mission-panel g-span-12" as="section">
              <PanelHead
                eyebrow="Today"
                title="Daily missions"
                action={<span className="pill">Resets at midnight</span>}
              />
              <ul className="mission-list">
                {missions.map((m) => (
                  <li key={m.id} className={`mission${m.claimed ? ' is-claimed' : ''}`}>
                    <span className="mission__mark" aria-hidden="true">
                      <Icon name={m.claimed ? 'check' : 'target'} size={17} />
                    </span>
                    <span className="mission__body">
                      <span className="mission__title">{m.title}</span>
                      <span className="mission__detail">{m.detail}</span>
                      <span className="mission__meter">
                        <ProgressBar
                          value={m.progress}
                          max={m.target}
                          tone={m.complete ? 'gold' : 'plain'}
                          label={`${m.title} progress`}
                        />
                        <span className="mission__count num">
                          {m.progress} / {m.target}
                        </span>
                      </span>
                    </span>
                    <span className="mission__reward num">
                      +{m.reward}
                      <span className="row__unit">VC</span>
                    </span>
                    <Button
                      variant={m.complete && !m.claimed ? 'gold' : 'outline'}
                      size="sm"
                      disabled={!m.complete || m.claimed}
                      icon={m.claimed ? 'check' : undefined}
                      onClick={() => onMission(m.id)}
                    >
                      {m.claimed ? 'Claimed' : m.complete ? 'Claim' : 'Locked'}
                    </Button>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel className="achievement-panel g-span-12" as="section">
              <PanelHead
                eyebrow="Lifetime"
                title="Achievements"
                action={<span className="pill">{unlocked} / {ACHIEVEMENTS.length}</span>}
              />
              <ul className="badge-grid">
                {ACHIEVEMENTS.map((a) => {
                  const got = achievements[a.id] != null
                  return (
                    <li key={a.id} className={`badge${got ? ' is-unlocked' : ''}`}>
                      <span className="badge__icon" aria-hidden="true">
                        <Icon name={got ? a.icon : 'lock'} size={20} />
                      </span>
                      <span className="badge__title">{a.title}</span>
                      <span className="badge__detail">{got ? 'Unlocked' : a.detail}</span>
                      {a.xp > 0 && (
                        <span className="badge__xp num">+{a.xp} XP</span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </Panel>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  )
}
