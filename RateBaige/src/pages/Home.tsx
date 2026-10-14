/* ------------------------------------------------------------------
   VANTA — Home.
   The original lobby, now driven by live state: balance, level/XP,
   win record, daily claim status and real recent activity.
   ------------------------------------------------------------------ */

import { ActivityList } from '../components/ActivityList'
import { roundToEntry, txnToEntry } from '../lib/activity'
import { BlackjackGlyph, CreditCoin, PokerGlyph, RouletteGlyph, TableArt } from '../components/art'
import { SiteFooter } from '../components/SiteFooter'
import { TopNav } from '../components/TopNav'
import { Button, EmptyState, Panel, ProgressBar } from '../components/ui'
import { formatCountdown, msUntilNextDay, percent } from '../lib/format'
import { useApp } from '../state/AppContext'

const GAMES = [
  {
    title: 'Blackjack',
    status: 'Available',
    live: true,
    href: '#/blackjack',
    note: 'One hand against the dealer. Stakes from 10 VC.',
    art: <BlackjackGlyph />,
  },
  {
    title: 'Roulette',
    status: 'Coming soon',
    live: false,
    href: '#/play',
    note: 'A single-zero wheel, quietly paced.',
    art: <RouletteGlyph />,
  },
  {
    title: 'Poker',
    status: 'Coming soon',
    live: false,
    href: '#/play',
    note: 'Five-card draw at your own pace.',
    art: <PokerGlyph />,
  },
]

export function Home() {
  const {
    state,
    level,
    stats,
    daily,
    refill,
    now,
    claimDailyReward,
    claimFreeRefill,
    notify,
    feedback,
  } = useApp()

  const entries =
    state.rounds.length > 0
      ? state.rounds.slice(0, 3).map(roundToEntry)
      : state.transactions.slice(0, 3).map(txnToEntry)

  const onClaimDaily = () => {
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

  const onClaimRefill = () => {
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

  const streakBars = Math.min(daily.streak, 7)

  return (
    <>
      <TopNav active="home" />

      <main className="page">
        <div className="shell">
          <div className="grid-12 page__grid">
            <div className="g-1-8">
              <p className="eyebrow">Game lobby</p>
              <h1 className="title-xl page__headline">Your table is waiting.</h1>
            </div>
            <p className="hero__note g-9-12">
              A quiet room of card games, played entirely with free virtual
              credits. Take a seat whenever you like — nothing here costs money.
            </p>

            {refill.eligible && (
              <div className="banner g-span-12" role="status">
                <span className="banner__icon" aria-hidden="true">
                  <CreditCoin size={30} />
                </span>
                <span className="banner__text">
                  <b>Running low?</b> Claim {refill.amount} VC free to keep playing.
                </span>
                <Button variant="gold" size="sm" onClick={onClaimRefill}>
                  Claim {refill.amount} VC
                </Button>
              </div>
            )}

            <section className="home-strip panel g-span-12" aria-label="Your progress">
              <div className="home-strip__progress">
                <div className="home-strip__row">
                  <span className="eyebrow eyebrow--muted">Level {level.level}</span>
                  <span className="home-strip__xp num">
                    {level.intoLevel} / {level.needed} XP
                  </span>
                </div>
                <ProgressBar
                  value={level.intoLevel}
                  max={level.needed}
                  label="Experience to next level"
                />
              </div>
              <dl className="home-strip__record">
                <div>
                  <dt>Won</dt>
                  <dd className="num is-pos">{stats.wins}</dd>
                </div>
                <div>
                  <dt>Lost</dt>
                  <dd className="num is-neg">{stats.losses}</dd>
                </div>
                <div>
                  <dt>Pushed</dt>
                  <dd className="num">{stats.pushes}</dd>
                </div>
                <div>
                  <dt>Win rate</dt>
                  <dd className="num">{percent(stats.winRate)}</dd>
                </div>
              </dl>
              <div className="home-strip__links">
                <a className="chip-link" href="#/rewards">
                  Rewards
                </a>
                <a className="chip-link" href="#/profile">
                  Profile
                </a>
              </div>
            </section>

            <article className="feature g-span-12">
              <div className="feature__body">
                <span className="eyebrow">Featured table</span>
                <h2 className="title-lg feature__title">Blackjack</h2>
                <p className="feature__desc">
                  One hand at a time against the dealer. Place a virtual stake,
                  then take your cards at your own pace.
                </p>
                <p className="feature__meta">
                  <span>6 decks</span>
                  <span className="sep" aria-hidden="true" />
                  <span>Dealer stands on 17</span>
                  <span className="sep" aria-hidden="true" />
                  <span className="num">Stakes 10–500 VC</span>
                </p>
                <div className="feature__actions">
                  <a className="btn btn--gold btn--lg" href="#/blackjack">
                    Play Blackjack
                  </a>
                  <span className="feature__stake">Virtual stakes only</span>
                </div>
              </div>
              <div className="feature__art">
                <TableArt />
              </div>
            </article>

            <section className="games g-span-12" aria-labelledby="explore-games">
              <div className="section-head">
                <h3 className="title-md" id="explore-games">
                  Explore games
                </h3>
                <a className="link" href="#/play">
                  All games →
                </a>
              </div>
              <div className="games-grid">
                {GAMES.map((game) => (
                  <a
                    key={game.title}
                    className={
                      game.live ? 'game-card game-card--live' : 'game-card game-card--soon'
                    }
                    href={game.href}
                  >
                    <span className="game-card__art" aria-hidden="true">
                      {game.art}
                    </span>
                    <span className="game-card__row">
                      <span className="title-sm">{game.title}</span>
                      <span className={game.live ? 'pill pill--gold' : 'pill'}>
                        {game.live && <span className="pill__dot" aria-hidden="true" />}
                        {game.status}
                      </span>
                    </span>
                    <span className="game-card__desc">{game.note}</span>
                  </a>
                ))}
              </div>
            </section>

            <Panel className="daily panel--felt g-span-4">
              <div className="daily__top">
                <div>
                  <p className="eyebrow">Daily credits</p>
                  <p className="daily__amount">
                    <span className="daily__value num">
                      {daily.claimedToday ? '0' : `+${daily.amount}`}
                    </span>
                    <span className="daily__unit">VC</span>
                  </p>
                </div>
                <CreditCoin size={50} />
              </div>

              <div className="streak">
                <span className="streak__bars" aria-hidden="true">
                  {Array.from({ length: 7 }, (_, i) => (
                    <span
                      key={i}
                      className={i < streakBars ? 'streak__bar streak__bar--on' : 'streak__bar'}
                    />
                  ))}
                </span>
                <span className="streak__label">{daily.streak}-day streak</span>
              </div>

              <Button
                variant="gold"
                block
                className="daily__cta"
                icon={daily.claimedToday ? 'check' : 'gift'}
                disabled={daily.claimedToday}
                onClick={onClaimDaily}
              >
                {daily.claimedToday ? 'Claimed today' : 'Claim reward'}
              </Button>

              <div className="daily__foot">
                <span>{daily.claimedToday ? 'Next reward tomorrow' : 'Available now'}</span>
                <span className="num">
                  Resets in {formatCountdown(msUntilNextDay(now))}
                </span>
              </div>
            </Panel>

            <Panel className="activity g-span-8" as="section">
              <div className="panel__body">
                <div className="panel__head">
                  <h3 className="title-md" id="recent-activity">
                    Recent activity
                  </h3>
                  <a className="link" href="#/history">
                    View history →
                  </a>
                </div>
                <ActivityList
                  entries={entries}
                  empty={
                    <EmptyState
                      icon="cards"
                      title="No games yet"
                      body="Your first hand of blackjack will appear here."
                      action={
                        <a className="btn btn--gold btn--sm" href="#/blackjack">
                          Play Blackjack
                        </a>
                      }
                    />
                  }
                />
              </div>
            </Panel>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  )
}
