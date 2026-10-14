/* ------------------------------------------------------------------
   VANTA — Credits.
   The original credits ledger, now backed by real transactions and the
   live daily-reward state. Layout and copy are unchanged.
   ------------------------------------------------------------------ */

import { txnToEntry } from '../lib/activity'
import { ActivityRow } from '../components/ActivityRow'
import { CreditCoin, StatusGlyph } from '../components/art'
import { SiteFooter } from '../components/SiteFooter'
import { TopNav } from '../components/TopNav'
import { STARTING_BALANCE } from '../lib/config'
import { dayKey, formatCountdown, formatCredits, formatDelta, msUntilNextDay } from '../lib/format'
import { useApp } from '../state/AppContext'

const STEPS = [
  'Credits are added free, and are never sold.',
  'Spend them on virtual stakes at any table.',
  'Winnings are credits too, never money.',
]

const WEEK = 7 * 86_400_000

export function Credits() {
  const { state, stats, daily, now, claimDailyReward, notify, feedback } = useApp()

  const ledger = state.transactions.slice(0, 6).map(txnToEntry)

  const earnedThisWeek = state.transactions
    .filter((t) => t.amount > 0 && t.at >= now - WEEK)
    .reduce((sum, t) => sum + t.amount, 0)

  const sessionsThisWeek = new Set(
    state.rounds.filter((r) => r.at >= now - WEEK).map((r) => dayKey(r.at)),
  ).size
  const weeklyTarget = 5
  const weeklyDone = Math.min(sessionsThisWeek, weeklyTarget)

  const onClaim = () => {
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

  return (
    <>
      <TopNav active="credits" />

      <main className="page">
        <div className="shell">
          <section className="pagehead">
            <div className="grid-12">
              <div className="g-1-8">
                <p className="eyebrow">Credits</p>
                <h1 className="title-lg pagehead__title">Your credits</h1>
                <p className="pagehead__balance">
                  <span className="pagehead__value num">
                    {formatCredits(state.balance)}
                  </span>
                  <span className="pagehead__unit">VC</span>
                </p>
                <p className="pagehead__caption">
                  <StatusGlyph kind="info" size={14} />
                  Free virtual credits. No monetary value. Not redeemable.
                </p>
              </div>
              <div className="pagehead__stats g-9-12">
                <div className="stat">
                  <p className="stat__label">Earned this week</p>
                  <p className="stat__value num">
                    {formatDelta(earnedThisWeek)}
                    <span className="u">VC</span>
                  </p>
                </div>
                <div className="stat">
                  <p className="stat__label">Sessions this week</p>
                  <p className="stat__value num">
                    {weeklyDone} of {weeklyTarget}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <div className="rule pagehead__rule" role="presentation" />

          <div className="grid-12 credits__grid">
            <div className="g-span-5 stack">
              <section className="daily panel panel--felt">
                <div className="daily__top">
                  <div>
                    <p className="eyebrow">Daily reward</p>
                    <p className="daily__amount">
                      <span className="daily__value num">
                        {daily.claimedToday ? '0' : daily.amount}
                      </span>
                      <span className="daily__unit">VC</span>
                    </p>
                  </div>
                  <CreditCoin size={54} />
                </div>

                <div className="streak">
                  <span className="streak__bars" aria-hidden="true">
                    {Array.from({ length: 7 }, (_, i) => (
                      <span
                        key={i}
                        className={
                          i < Math.min(daily.streak, 7)
                            ? 'streak__bar streak__bar--on'
                            : 'streak__bar'
                        }
                      />
                    ))}
                  </span>
                  <span className="streak__label">{daily.streak}-day streak</span>
                </div>

                <button
                  className="btn btn--gold btn--block daily__cta"
                  type="button"
                  disabled={daily.claimedToday}
                  onClick={onClaim}
                >
                  {daily.claimedToday ? 'Claimed today' : 'Claim credits'}
                </button>

                <div className="daily__foot">
                  <span>{daily.claimedToday ? 'Claimed' : 'Unclaimed'}</span>
                  <span className="num">
                    Resets in {formatCountdown(msUntilNextDay(now))}
                  </span>
                </div>
              </section>

              <section className="progress panel" aria-labelledby="weekly-milestone">
                <p className="eyebrow eyebrow--muted" id="weekly-milestone">
                  Weekly milestone
                </p>
                <p className="progress__count">
                  <b className="num">
                    {weeklyDone} of {weeklyTarget}
                  </b>{' '}
                  sessions completed
                </p>
                <div className="progress__meter" aria-hidden="true">
                  {Array.from({ length: weeklyTarget }, (_, i) => (
                    <span
                      key={i}
                      className={
                        i < weeklyDone ? 'progress__seg progress__seg--done' : 'progress__seg'
                      }
                    />
                  ))}
                </div>
                <p className="progress__foot">
                  {weeklyDone >= weeklyTarget ? (
                    <>
                      Milestone reached — a <b>+500 VC</b> bonus has been noted on
                      your account.
                    </>
                  ) : (
                    <>
                      {weeklyTarget - weeklyDone} more session
                      {weeklyTarget - weeklyDone === 1 ? '' : 's'} this week unlock a{' '}
                      <b>+500 VC</b> bonus.
                    </>
                  )}
                </p>
              </section>

              <section className="explainer panel" aria-labelledby="how-credits-work">
                <p className="eyebrow eyebrow--muted" id="how-credits-work">
                  How credits work
                </p>
                <ol className="explainer__list">
                  {STEPS.map((step, i) => (
                    <li className="explainer__item" key={step}>
                      <span className="explainer__idx num">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
                <p className="explainer__note">
                  Guests begin with {formatCredits(STARTING_BALANCE)} VC. There is
                  nothing to buy and nothing to cash out.
                </p>
              </section>
            </div>

            <section className="ledger panel g-span-7" aria-labelledby="credit-activity">
              <div className="panel__head">
                <h2 className="title-md" id="credit-activity">
                  Recent credit activity
                </h2>
                <a className="link" href="#/history">
                  View full history →
                </a>
              </div>

              <div className="ledger__cols" aria-hidden="true">
                <span />
                <span>Activity</span>
                <span>Date</span>
                <span>Amount</span>
              </div>

              <ul className="ledger__rows">
                {ledger.map((entry, i) => (
                  <ActivityRow key={`${entry.name}-${entry.time}-${i}`} entry={entry} />
                ))}
              </ul>

              <div className="ledger__foot">
                <p className="ledger__stat">
                  Net from play
                  <b className={`num ${stats.net >= 0 ? 'is-pos' : 'is-neg'}`}>
                    {formatDelta(stats.net)}
                    <span className="row__unit">VC</span>
                  </b>
                </p>
                <p className="ledger__stat">
                  Balance
                  <b className="num">
                    {formatCredits(state.balance)}
                    <span className="row__unit">VC</span>
                  </b>
                </p>
              </div>
            </section>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  )
}
