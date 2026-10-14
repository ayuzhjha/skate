/* ------------------------------------------------------------------
   VANTA — Play.
   The games catalogue. Blackjack is live; the rest are clearly
   marked as coming soon so no dead buttons lead anywhere.
   ------------------------------------------------------------------ */

import { BlackjackGlyph, PokerGlyph, RouletteGlyph } from '../components/art'
import { SiteFooter } from '../components/SiteFooter'
import { TopNav } from '../components/TopNav'
import { Panel } from '../components/ui'
import { Icon } from '../components/Icon'
import { GAMES } from '../lib/config'
import { roundToEntry } from '../lib/activity'
import { formatDelta } from '../lib/format'
import { useApp } from '../state/AppContext'

const ART: Record<string, React.ReactNode> = {
  blackjack: <BlackjackGlyph size={40} />,
  roulette: <RouletteGlyph size={40} />,
  poker: <PokerGlyph size={40} />,
  slots: <Icon name="spark" size={36} />,
}

export function Play() {
  const { state, stats } = useApp()
  const live = GAMES.filter((g) => g.status === 'available')
  const soon = GAMES.filter((g) => g.status === 'soon')
  const recent = state.rounds.slice(0, 3)

  return (
    <>
      <TopNav active="play" />

      <main className="page">
        <div className="shell">
          <div className="grid-12 page__grid">
            <div className="g-1-8">
              <p className="eyebrow">Games</p>
              <h1 className="title-lg page__headline">Choose your table.</h1>
            </div>
            <p className="hero__note g-9-12">
              Every game is played with free virtual credits. Blackjack is ready
              now; more tables are on the way.
            </p>

            <section className="g-span-12" aria-labelledby="available-games">
              <div className="section-head">
                <h2 className="title-md" id="available-games">
                  Available now
                </h2>
                <span className="pill pill--gold">
                  <span className="pill__dot" aria-hidden="true" />
                  {live.length} live
                </span>
              </div>

              <div className="game-list">
                {live.map((game) => (
                  <article key={game.id} className="game-row panel game-row--live">
                    <span className="game-row__art" aria-hidden="true">
                      {ART[game.id]}
                    </span>
                    <div className="game-row__body">
                      <div className="game-row__title">
                        <h3 className="title-md">{game.title}</h3>
                        <span className="pill pill--gold">
                          <span className="pill__dot" aria-hidden="true" />
                          Available
                        </span>
                      </div>
                      <p className="game-row__desc">{game.description}</p>
                      <p className="game-row__meta num">
                        Stakes {game.minBet}–{game.maxBet} VC
                      </p>
                    </div>
                    <div className="game-row__actions">
                      <a className="btn btn--gold" href="#/blackjack">
                        Play now
                      </a>
                      <a className="link" href="#/how-to-play">
                        How to play
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            {recent.length > 0 && (
              <Panel className="g-span-12 resume" as="section">
                <div className="panel__body">
                  <div className="panel__head">
                    <h2 className="title-md">Pick up where you left off</h2>
                    <a className="link" href="#/history">
                      All activity →
                    </a>
                  </div>
                  <ul className="resume__list">
                    {recent.map((r) => {
                      const e = roundToEntry(r)
                      return (
                        <li key={r.id} className="resume__item">
                          <span className="resume__result">
                            <span
                              className={`row__icon ${
                                e.tone === 'gold'
                                  ? 'row__icon--gold'
                                  : e.tone === 'red'
                                    ? 'row__icon--red'
                                    : ''
                              }`}
                              aria-hidden="true"
                            >
                              <Icon name="cards" size={15} />
                            </span>
                            <span>
                              <b>{e.name}</b>
                              <em>{r.detail}</em>
                            </span>
                          </span>
                          <span className={`resume__net num is-${e.direction}`}>
                            {formatDelta(r.net)}
                            <span className="row__unit">VC</span>
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                  <dl className="resume__totals">
                    <div>
                      <dt>Rounds played</dt>
                      <dd className="num">{stats.played}</dd>
                    </div>
                    <div>
                      <dt>Net credits</dt>
                      <dd className={`num ${stats.net >= 0 ? 'is-pos' : 'is-neg'}`}>
                        {formatDelta(stats.net)}
                      </dd>
                    </div>
                  </dl>
                </div>
              </Panel>
            )}

            <section className="g-span-12" aria-labelledby="soon-games">
              <div className="section-head">
                <h2 className="title-md" id="soon-games">
                  Coming soon
                </h2>
              </div>
              <div className="games-grid">
                {soon.map((game) => (
                  <div key={game.id} className="game-card game-card--soon" aria-disabled="true">
                    <span className="game-card__art" aria-hidden="true">
                      {ART[game.id]}
                    </span>
                    <span className="game-card__row">
                      <span className="title-sm">{game.title}</span>
                      <span className="pill">
                        <Icon name="lock" size={11} />
                        Coming soon
                      </span>
                    </span>
                    <span className="game-card__desc">{game.description}</span>
                  </div>
                ))}
              </div>
            </section>

            <div className="g-span-12 note-row">
              <Icon name="info" size={15} />
              <p>
                VANTA is a simulation. Virtual credits have no monetary value and
                cannot be redeemed.
              </p>
              <a className="btn btn--ghost btn--sm" href="#/how-to-play">
                <Icon name="book" size={15} />
                <span>How to play</span>
              </a>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  )
}
