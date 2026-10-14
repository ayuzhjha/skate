/* ------------------------------------------------------------------
   VANTA — Statistics.
   Every figure is computed from recorded rounds; nothing is hardcoded.
   ------------------------------------------------------------------ */

import { ActivityList } from '../components/ActivityList'
import { roundToEntry } from '../lib/activity'
import { Icon } from '../components/Icon'
import { SiteFooter } from '../components/SiteFooter'
import { TopNav } from '../components/TopNav'
import { EmptyState, Panel, PanelHead, ProgressBar, Stat } from '../components/ui'
import { GAMES } from '../lib/config'
import { formatCredits, formatDelta, percent } from '../lib/format'
import { useApp } from '../state/AppContext'

function Sparkline({ values }: { values: number[] }) {
  if (values.length === 0) {
    return <div className="spark spark--empty" aria-hidden="true" />
  }
  const max = Math.max(1, ...values.map((v) => Math.abs(v)))
  const barW = 100 / values.length
  return (
    <svg
      className="spark"
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
      role="img"
      aria-label="Net credits for your most recent rounds"
    >
      <line x1="0" y1="20" x2="100" y2="20" stroke="rgba(241,235,221,0.14)" strokeWidth="0.4" />
      {values.map((v, i) => {
        const h = (Math.abs(v) / max) * 17
        const x = i * barW + barW * 0.2
        const w = barW * 0.6
        const y = v >= 0 ? 20 - h : 20
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={w}
            height={Math.max(0.8, h)}
            rx="0.6"
            fill={v >= 0 ? '#cfae72' : '#ad514a'}
            opacity={v >= 0 ? 0.85 : 0.8}
          />
        )
      })}
    </svg>
  )
}

export function StatsView() {
  const { stats } = useApp()
  const recent = stats.recent.map(roundToEntry)

  return (
    <>
      <TopNav active="stats" />

      <main className="page">
        <div className="shell">
          <div className="grid-12 page__grid">
            <div className="g-1-8">
              <p className="eyebrow">Statistics</p>
              <h1 className="title-lg page__headline">How you've been playing.</h1>
            </div>
            <p className="hero__note g-9-12">
              Calculated live from your recorded rounds. Virtual credits only — no
              monetary value.
            </p>

            <Panel className="g-span-12" as="section">
              <PanelHead
                eyebrow="Overview"
                title="Your play"
                action={
                  <a className="link" href="#/history">
                    Full history →
                  </a>
                }
              />
              <div className="stat-grid">
                <Stat label="Rounds played" value={stats.played} />
                <Stat label="Won" value={stats.wins} tone="gold" />
                <Stat label="Lost" value={stats.losses} tone="red" />
                <Stat label="Pushed" value={stats.pushes} />
                <Stat label="Natural blackjacks" value={stats.blackjacks} tone="gold" />
                <Stat label="Busts" value={stats.busts} tone="red" />
                <Stat label="Win rate" value={percent(stats.winRate)} hint="Won ÷ decided" />
                <Stat label="Average stake" value={formatCredits(stats.avgStake)} unit="VC" />
              </div>
            </Panel>

            <Panel className="g-span-7" as="section">
              <PanelHead eyebrow="Recent form" title="Last 12 rounds" />
              <Sparkline values={stats.sparkline} />
              <div className="spark-legend">
                <span>
                  <i className="dot dot--gold" /> Net win
                </span>
                <span>
                  <i className="dot dot--red" /> Net loss
                </span>
              </div>
              <div className="stat-grid stat-grid--tight">
                <Stat
                  label="Net credits"
                  value={formatDelta(stats.net)}
                  tone={stats.net >= 0 ? 'gold' : 'red'}
                />
                <Stat label="Total staked" value={formatCredits(stats.staked)} unit="VC" />
                <Stat label="Total returned" value={formatCredits(stats.returned)} unit="VC" />
              </div>
            </Panel>

            <Panel className="g-span-5" as="section">
              <PanelHead eyebrow="Highs & lows" title="Best and worst" />
              <ul className="record-list">
                <li>
                  <span className="record-list__label">
                    <Icon name="up" size={16} /> Biggest win
                  </span>
                  <span className="record-list__value num is-pos">
                    +{formatCredits(stats.biggestWin)}
                    <span className="row__unit">VC</span>
                  </span>
                </li>
                <li>
                  <span className="record-list__label">
                    <Icon name="down" size={16} /> Biggest loss
                  </span>
                  <span className="record-list__value num is-neg">
                    {formatDelta(stats.biggestLoss)}
                    <span className="row__unit">VC</span>
                  </span>
                </li>
                <li>
                  <span className="record-list__label">
                    <Icon name="stats" size={16} /> Decided hands
                  </span>
                  <span className="record-list__value num">{stats.decided}</span>
                </li>
                <li>
                  <span className="record-list__label">
                    <Icon name="cards" size={16} /> Return rate
                  </span>
                  <span className="record-list__value num">
                    {stats.staked > 0 ? percent(stats.returned / stats.staked) : '—'}
                  </span>
                </li>
              </ul>
            </Panel>

            <Panel className="g-span-12" as="section">
              <PanelHead eyebrow="By game" title="Breakdown" />
              <ul className="game-stats">
                {GAMES.map((g) => {
                  const s = stats.byGame[g.id]
                  const share = stats.played > 0 ? s.played / stats.played : 0
                  return (
                    <li className="game-stat" key={g.id}>
                      <span className="game-stat__head">
                        <span className="game-stat__name">{g.title}</span>
                        <span className="game-stat__played num">
                          {s.played} round{s.played === 1 ? '' : 's'}
                        </span>
                      </span>
                      <ProgressBar value={share} max={1} tone="plain" label={`${g.title} share`} />
                      <span className="game-stat__meta">
                        <span className="num is-pos">{s.wins} won</span>
                        <span className="num is-neg">{s.losses} lost</span>
                        <span className="num">
                          {s.played > 0 ? percent(s.winRate) : '—'} win rate
                        </span>
                        <span className={`num ${s.net >= 0 ? 'is-pos' : 'is-neg'}`}>
                          {formatDelta(s.net)} VC
                        </span>
                      </span>
                    </li>
                  )
                })}
              </ul>
            </Panel>

            <Panel className="g-span-12" as="section">
              <PanelHead eyebrow="Latest" title="Recent rounds" />
              <ActivityList
                entries={recent}
                empty={
                  <EmptyState
                    icon="stats"
                    title="Nothing to chart yet"
                    body="Play a few rounds and your statistics will build up here."
                    action={
                      <a className="btn btn--gold btn--sm" href="#/blackjack">
                        Play Blackjack
                      </a>
                    }
                  />
                }
              />
            </Panel>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  )
}
