/* ------------------------------------------------------------------
   VANTA — History.
   Every recorded round and credit movement, with filters by game,
   outcome and date. Reads straight from the store.
   ------------------------------------------------------------------ */

import { useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { SiteFooter } from '../components/SiteFooter'
import { TopNav } from '../components/TopNav'
import { Button, EmptyState, Panel, PanelHead, Segmented } from '../components/ui'
import { GAMES } from '../lib/config'
import { dayLabel, formatClock, formatCredits, formatDelta } from '../lib/format'
import { filterRounds, type OutcomeFilter } from '../lib/stats'
import { useApp } from '../state/AppContext'
import type { GameId, Round } from '../lib/types'

const OUTCOMES: { value: OutcomeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'win', label: 'Won' },
  { value: 'loss', label: 'Lost' },
  { value: 'push', label: 'Push' },
]

const RESULT_LABEL: Record<Round['result'], string> = {
  win: 'Won',
  blackjack: 'Blackjack',
  loss: 'Lost',
  bust: 'Bust',
  push: 'Push',
}

function outcomeTone(r: Round): string {
  if (r.result === 'win' || r.result === 'blackjack') return 'is-pos'
  if (r.result === 'loss' || r.result === 'bust') return 'is-neg'
  return 'is-flat'
}

function groupByDay(rounds: Round[]): { label: string; items: Round[] }[] {
  const groups: { label: string; items: Round[] }[] = []
  for (const r of rounds) {
    const label = dayLabel(r.at)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(r)
    else groups.push({ label, items: [r] })
  }
  return groups
}

export function History() {
  const { state, now, notify, feedback } = useApp()
  const [game, setGame] = useState<GameId | 'all'>('all')
  const [outcome, setOutcome] = useState<OutcomeFilter>('all')
  const [range, setRange] = useState<'all' | '7' | '30'>('all')

  const from = useMemo(() => {
    if (range === 'all') return undefined
    const days = range === '7' ? 7 : 30
    return now - days * 86_400_000
  }, [range, now])

  const rounds = useMemo(
    () => filterRounds(state.rounds, { game, outcome, from }),
    [state.rounds, game, outcome, from],
  )

  const groups = useMemo(() => groupByDay(rounds), [rounds])
  const filtered = game !== 'all' || outcome !== 'all' || range !== 'all'
  const gameOptions = [
    { value: 'all' as const, label: 'All games' },
    ...GAMES.map((g) => ({ value: g.id, label: g.title })),
  ]

  const exportCsv = () => {
    const header = 'date,game,stake,payout,net,result,detail'
    const lines = rounds.map((r) =>
      [
        new Date(r.at).toISOString(),
        r.game,
        r.stake,
        r.payout,
        r.net,
        r.result,
        `"${r.detail.replace(/"/g, "'")}"`,
      ].join(','),
    )
    const blob = new Blob([`${header}\n${lines.join('\n')}`], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'vanta-history.csv'
    a.click()
    URL.revokeObjectURL(url)
    feedback.play('tap')
    notify({ title: 'History exported', tone: 'plain', icon: 'history' })
  }

  return (
    <>
      <TopNav active="history" />

      <main className="page">
        <div className="shell">
          <div className="grid-12 page__grid">
            <div className="g-1-8">
              <p className="eyebrow">History</p>
              <h1 className="title-lg page__headline">Every hand, recorded.</h1>
            </div>
            <p className="hero__note g-9-12">
              A complete ledger of your virtual play. Nothing here involves real
              money.
            </p>

            <Panel className="g-span-12 filter-panel" as="section">
              <div className="filter-bar">
                <label className="filter">
                  <span className="filter__label">Game</span>
                  <span className="select">
                    <select
                      value={game}
                      onChange={(e) => setGame(e.target.value as GameId | 'all')}
                    >
                      {gameOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <Icon name="chevron" size={15} />
                  </span>
                </label>

                <div className="filter">
                  <span className="filter__label">Outcome</span>
                  <Segmented
                    label="Outcome filter"
                    options={OUTCOMES}
                    value={outcome}
                    onChange={setOutcome}
                  />
                </div>

                <div className="filter">
                  <span className="filter__label">Period</span>
                  <Segmented
                    label="Date range"
                    value={range}
                    onChange={setRange}
                    options={[
                      { value: '7', label: '7 days' },
                      { value: '30', label: '30 days' },
                      { value: 'all', label: 'All time' },
                    ]}
                  />
                </div>

                <div className="filter filter--end">
                  <span className="filter__label" aria-hidden="true">
                    &nbsp;
                  </span>
                  <div className="filter__actions">
                    <Button
                      variant="outline"
                      size="sm"
                      icon="refresh"
                      disabled={!filtered}
                      onClick={() => {
                        setGame('all')
                        setOutcome('all')
                        setRange('all')
                      }}
                    >
                      Clear
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="down"
                      disabled={rounds.length === 0}
                      onClick={exportCsv}
                    >
                      Export
                    </Button>
                  </div>
                </div>
              </div>
            </Panel>

            <Panel className="g-span-12 history-panel" as="section">
              <PanelHead
                eyebrow="Rounds"
                title={`${rounds.length} result${rounds.length === 1 ? '' : 's'}`}
              />
              {rounds.length === 0 ? (
                <EmptyState
                  icon="history"
                  title={state.rounds.length === 0 ? 'No rounds yet' : 'No matches'}
                  body={
                    state.rounds.length === 0
                      ? 'Play a hand of blackjack and it will appear here.'
                      : 'Try widening the filters to see more of your play.'
                  }
                  action={
                    <a className="btn btn--gold btn--sm" href="#/blackjack">
                      Play Blackjack
                    </a>
                  }
                />
              ) : (
                <div className="history">
                  {groups.map((group) => (
                    <section className="history__day" key={group.label}>
                      <h3 className="history__daylabel">{group.label}</h3>
                      <ul className="history__list">
                        {group.items.map((r) => (
                          <li className="history__item" key={r.id}>
                            <span className="history__icon" aria-hidden="true">
                              <Icon
                                name={
                                  r.result === 'blackjack'
                                    ? 'spark'
                                    : r.result === 'win'
                                      ? 'check'
                                      : r.result === 'push'
                                        ? 'shield'
                                        : 'chip'
                                }
                                size={16}
                              />
                            </span>
                            <span className="history__main">
                              <span className="history__title">
                                Blackjack
                                <span className={`tag ${outcomeTone(r)}`}>
                                  {RESULT_LABEL[r.result]}
                                </span>
                              </span>
                              <span className="history__detail">{r.detail}</span>
                            </span>
                            <span className="history__figures">
                              <span className="history__stake num">
                                Stake {formatCredits(r.stake)}
                              </span>
                              <span className="history__time num">{formatClock(r.at)}</span>
                            </span>
                            <span className={`history__net num ${outcomeTone(r)}`}>
                              {formatDelta(r.net)}
                              <span className="row__unit">VC</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </Panel>

            <Panel className="g-span-12" as="section">
              <PanelHead eyebrow="Ledger" title="Credit transactions" />
              <ul className="rows rows--compact">
                {state.transactions.slice(0, 10).map((t) => (
                  <li className="ledger-line" key={t.id}>
                    <span className="ledger-line__label">
                      <Icon name={t.icon} size={15} />
                      {t.label}
                    </span>
                    <span className="ledger-line__time num">
                      {dayLabel(t.at)} · {formatClock(t.at)}
                    </span>
                    <span
                      className={`ledger-line__amt num ${
                        t.amount > 0 ? 'is-pos' : t.amount < 0 ? 'is-neg' : ''
                      }`}
                    >
                      {formatDelta(t.amount)}
                      <span className="row__unit">VC</span>
                    </span>
                    <span className="ledger-line__bal num">
                      {formatCredits(t.balanceAfter)}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  )
}
