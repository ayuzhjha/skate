/* ------------------------------------------------------------------
   VANTA — Blackjack.
   The UI is a thin shell over the pure engine in lib/engine/blackjack
   and the atomic credit layer in state/AppContext. Every action routes
   through `canX`/`stakeFor` guards, so illegal or unaffordable moves are
   impossible rather than merely discouraged.
   ------------------------------------------------------------------ */

import { useCallback, useEffect, useRef, useState } from 'react'
import { CardFace } from '../components/Cards'
import { Icon } from '../components/Icon'
import { SiteFooter } from '../components/SiteFooter'
import { TopNav } from '../components/TopNav'
import { Button, Modal, Panel, ProgressBar } from '../components/ui'
import {
  MAX_BET,
  MIN_BET,
  CHIPS,
  XP_BLACKJACK_BONUS,
  XP_ROUND,
  XP_WIN_BONUS,
} from '../lib/config'
import { formatDelta } from '../lib/format'
import { handValue } from '../lib/engine/deck'
import {
  applyAction,
  canDouble,
  canHit,
  canSplit,
  canStand,
  describeRound,
  reachedTwentyOne,
  roundResult,
  stakeFor,
  startRound,
  type BjAction,
  type BjHand,
  type BjState,
} from '../lib/engine/blackjack'
import { useApp } from '../state/AppContext'
import { uid } from '../lib/uid'
import type { Round } from '../lib/types'

type Outcome = {
  result: Round['result']
  net: number
  title: string
  detail: string
}

function bestTotal(hands: BjHand[]): number {
  return hands.reduce((max, h) => Math.max(max, handValue(h.cards).total), 0)
}

function outcomeFor(state: BjState): Outcome {
  const result = roundResult(state)
  const net = state.totalPayout - state.totalStake
  const title =
    result === 'blackjack'
      ? 'Blackjack'
      : result === 'win'
        ? 'You win'
        : result === 'push'
          ? 'Push'
          : result === 'bust'
            ? 'Bust'
            : 'Dealer wins'
  return { result, net, title, detail: describeRound(state) }
}

export function Blackjack() {
  const {
    state,
    placeStake,
    settle,
    notify,
    feedback,
    reducedMotion,
    refill,
    claimFreeRefill,
  } = useApp()

  const [round, setRound] = useState<BjState | null>(null)
  const [bet, setBet] = useState(100)
  const [dealerShown, setDealerShown] = useState(2)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [rulesOpen, setRulesOpen] = useState(false)

  const roundId = useRef<string>('')
  const settledFor = useRef<string | null>(null)

  const balance = state.balance
  const affordable = balance >= bet
  const inPlay = round?.phase === 'player'

  /* ---------- dealing ---------- */

  const startGame = useCallback(
    (stake: number) => {
      if (stake < MIN_BET || stake > MAX_BET) {
        notify({
          title: 'Invalid stake',
          body: `Choose between ${MIN_BET} and ${MAX_BET} VC.`,
          tone: 'red',
          icon: 'info',
        })
        feedback.play('error')
        return
      }
      if (balance < stake) {
        notify({
          title: 'Not enough credits',
          body: 'Lower your stake, or claim a free top-up.',
          tone: 'red',
          icon: 'info',
        })
        feedback.play('error')
        return
      }
      const id = uid('round')
      roundId.current = id
      settledFor.current = null
      placeStake(stake, 'Stake placed', id)
      const next = startRound(round, stake, Math.floor(Math.random() * 0xffffffff))
      setRound(next)
      setOutcome(null)
      setDealerShown(2)
      feedback.play('deal')
    },
    [balance, feedback, notify, placeStake, round],
  )

  /* ---------- player actions ---------- */

  const act = useCallback(
    (action: BjAction) => {
      if (!round || round.phase !== 'player') return
      const allowed =
        action === 'hit'
          ? canHit(round)
          : action === 'stand'
            ? true
            : action === 'double'
              ? canDouble(round)
              : canSplit(round)
      if (!allowed) {
        feedback.play('error')
        return
      }
      const extra = stakeFor(round, action)
      if (extra > 0 && balance < extra) {
        notify({
          title: 'Not enough credits',
          body:
            action === 'double'
              ? 'Doubling down needs another stake of the same size.'
              : 'Splitting needs another stake of the same size.',
          tone: 'red',
          icon: 'info',
        })
        feedback.play('error')
        return
      }
      if (extra > 0) {
        placeStake(
          extra,
          action === 'double' ? 'Double down' : 'Split hand',
          roundId.current,
        )
      }
      const next = applyAction(round, action)
      setRound(next)
      feedback.play(action === 'stand' ? 'tap' : 'chip')
    },
    [round, balance, notify, feedback, placeStake],
  )

  /* ---------- dealer reveal + settlement ---------- */

  useEffect(() => {
    if (!round || round.phase !== 'settled') return
    if (dealerShown < round.dealer.length) {
      const t = window.setTimeout(
        () => setDealerShown((n) => n + 1),
        reducedMotion ? 40 : 430,
      )
      return () => window.clearTimeout(t)
    }
    if (settledFor.current === roundId.current) return
    settledFor.current = roundId.current

    const out = outcomeFor(round)
    const won = out.net > 0
    const natural = round.hands.some((h) => h.result === 'blackjack')
    const xp = XP_ROUND + (won ? XP_WIN_BONUS : 0) + (natural ? XP_BLACKJACK_BONUS : 0)

    settle({
      roundId: roundId.current,
      at: Date.now(),
      stake: round.totalStake,
      payout: round.totalPayout,
      result: out.result,
      detail: out.detail,
      playerTotal: bestTotal(round.hands),
      dealerTotal: handValue(round.dealer).total,
      hands: round.hands.length,
      won,
      reached21: reachedTwentyOne(round),
      xp,
    })
    setOutcome(out)
    feedback.play(out.net > 0 ? 'win' : out.net === 0 ? 'chip' : 'lose')

    if (state.player.settings.notifications.results) {
      notify({
        title: out.title,
        body: `${out.detail} · ${formatDelta(out.net)} VC`,
        tone: out.net > 0 ? 'gold' : out.net < 0 ? 'red' : 'plain',
        icon: out.net > 0 ? 'trophy' : 'info',
      })
    }
  }, [round, dealerShown, settle, notify, feedback, reducedMotion, state.player.settings.notifications.results])

  /* ---------- bet controls ---------- */

  const addChip = (value: number) => {
    if (inPlay) return
    const cap = Math.min(MAX_BET, balance)
    setBet((b) => Math.min(cap, b + value))
    feedback.play('chip')
  }
  const clearBet = () => {
    if (inPlay) return
    setBet(0)
    feedback.play('tap')
  }
  const setMax = () => {
    if (inPlay) return
    setBet(Math.min(MAX_BET, balance))
    feedback.play('chip')
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

  /* ---------- derived ---------- */

  const dealerCards = round
    ? round.dealer.slice(0, round.phase === 'settled' ? Math.max(2, dealerShown) : 2)
    : []
  const dealerTotalValue = round
    ? handValue(round.holeRevealed ? round.dealer : round.dealer.slice(0, 1)).total
    : 0
  const revealing =
    round?.phase === 'settled' && dealerShown < round.dealer.length
  const settled = round?.phase === 'settled' && !revealing
  const extraNeeded = round && round.phase === 'player' ? stakeFor(round, 'double') : 0
  const canDeal = !inPlay && affordable && bet >= MIN_BET

  return (
    <>
      <TopNav active="blackjack" />

      <main className="page bj">
        <div className="shell bj__shell">
          <div className="bj__bar">
            <a className="link link--back" href="#/play">
              <Icon name="chevron" size={15} />
              All games
            </a>
            <div className="bj__titles">
              <p className="eyebrow">Table 1 · Six decks</p>
              <h1 className="title-md">Blackjack</h1>
            </div>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setRulesOpen(true)}
            >
              <Icon name="book" size={15} />
              <span>Rules</span>
            </button>
          </div>

          <section className="bj-table" aria-label="Blackjack table">
            <div className="bj-seat bj-seat--dealer">
              <div className="bj-seat__head">
                <span className="bj-seat__label">Dealer</span>
                <span className="bj-total num">
                  {round ? (round.holeRevealed ? dealerTotalValue : `${dealerTotalValue}`) : '—'}
                  {round && !round.holeRevealed && <em className="bj-total__hidden">?</em>}
                </span>
              </div>
              <div className="bj-cards" aria-live="polite">
                {dealerCards.length === 0 && <span className="bj-cards__empty" />}
                {dealerCards.map((card, i) => (
                  <span
                    className="bj-card"
                    key={card.id}
                    style={{ animationDelay: `${i * 70}ms` }}
                  >
                    <CardFace card={card} faceDown={!round?.holeRevealed && i === 1} />
                  </span>
                ))}
              </div>
            </div>

            <div className="bj-centre">
              {outcome && settled ? (
                <div className={`bj-outcome bj-outcome--${outcome.result}`} role="status">
                  <span className="bj-outcome__title">{outcome.title}</span>
                  <span className={`bj-outcome__net num ${outcome.net >= 0 ? 'is-pos' : 'is-neg'}`}>
                    {formatDelta(outcome.net)}
                    <span className="row__unit">VC</span>
                  </span>
                  <span className="bj-outcome__detail">{outcome.detail}</span>
                </div>
              ) : (
                <div className="bj-status" role="status">
                  {!round && 'Place a stake to begin.'}
                  {inPlay &&
                    (round!.hands.length > 1
                      ? `Playing hand ${round!.active + 1} of ${round!.hands.length}`
                      : 'Your move.')}
                  {revealing && 'Dealer plays…'}
                </div>
              )}

              {round && (
                <div className="bj-stake">
                  <Icon name="chip" size={15} />
                  <span className="num">{round.totalStake.toLocaleString('en-US')}</span>
                  <span className="bj-stake__unit">VC at stake</span>
                </div>
              )}
            </div>

            <div className="bj-seat bj-seat--player">
              <div className="bj-hands">
                {(round?.hands ?? []).map((hand, i) => {
                  const value = handValue(hand.cards)
                  const isActive = round?.phase === 'player' && round.active === i
                  const label =
                    hand.result === 'bust'
                      ? 'Bust'
                      : hand.result === 'blackjack'
                        ? 'Blackjack'
                        : hand.result === 'win'
                          ? 'Won'
                          : hand.result === 'loss'
                            ? 'Lost'
                            : hand.result === 'push'
                              ? 'Push'
                              : null
                  return (
                    <div
                      className={`bj-hand${isActive ? ' is-active' : ''}${
                        hand.done ? ' is-done' : ''
                      }`}
                      key={i}
                    >
                      <div className="bj-hand__head">
                        <span className="bj-total num">
                          {value.total}
                          {value.soft && <em className="bj-total__soft">soft</em>}
                        </span>
                        {label && (
                          <span className={`tag tag--${hand.result}`}>{label}</span>
                        )}
                        {hand.doubled && <span className="tag">Doubled</span>}
                        {hand.split && <span className="tag">Split</span>}
                      </div>
                      <div className="bj-cards">
                        {hand.cards.map((card, ci) => (
                          <span
                            className="bj-card"
                            key={card.id}
                            style={{ animationDelay: `${ci * 70}ms` }}
                          >
                            <CardFace card={card} />
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })}
                {!round && (
                  <div className="bj-hand bj-hand--placeholder">
                    <div className="bj-hand__head">
                      <span className="bj-total num">—</span>
                    </div>
                    <div className="bj-cards">
                      <span className="bj-card bj-card--ghost" />
                      <span className="bj-card bj-card--ghost" />
                    </div>
                  </div>
                )}
              </div>
              <div className="bj-seat__head bj-seat__head--player">
                <span className="bj-seat__label">You</span>
                <span className="bj-balance num">
                  {balance.toLocaleString('en-US')}
                  <span className="u">VC</span>
                </span>
              </div>
            </div>
          </section>

          <Panel className="bj-console" as="section">
            {refill.eligible && (
              <div className="bj-lowcredit">
                <span>
                  Your balance is under 100 VC. Take a free {refill.amount} VC
                  top-up.
                </span>
                <Button variant="gold" size="sm" icon="gift" onClick={onClaimRefill}>
                  Claim {refill.amount} VC
                </Button>
              </div>
            )}

            {inPlay ? (
              <div className="bj-actions" role="group" aria-label="Table actions">
                <Button
                  variant="gold"
                  size="lg"
                  icon="plus"
                  onClick={() => act('hit')}
                  disabled={!canHit(round!)}
                >
                  Hit
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  icon="check"
                  onClick={() => act('stand')}
                  disabled={!canStand(round!)}
                >
                  Stand
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  icon="up"
                  onClick={() => act('double')}
                  disabled={!canDouble(round!) || balance < extraNeeded}
                >
                  Double
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  icon="cards"
                  onClick={() => act('split')}
                  disabled={!canSplit(round!) || balance < stakeFor(round!, 'split')}
                >
                  Split
                </Button>
              </div>
            ) : (
              <>
                <div className="bj-bet">
                  <div className="bj-bet__head">
                    <span className="eyebrow eyebrow--muted">Your stake</span>
                    <span className="bj-bet__value num">
                      {bet.toLocaleString('en-US')}
                      <span className="u">VC</span>
                    </span>
                  </div>
                  <div className="chips" role="group" aria-label="Chip denominations">
                    {CHIPS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className="chip-btn"
                        onClick={() => addChip(c)}
                        disabled={inPlay || c > Math.min(MAX_BET, balance)}
                        aria-label={`Add ${c} virtual credits`}
                      >
                        <span
                          className={`chip-btn__disc chip-btn__disc--${
                            c >= 500 ? 'ink' : c >= 100 ? 'gold' : c >= 50 ? 'red' : 'ivory'
                          }`}
                        >
                          {c}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="bj-bet__tools">
                    <Button variant="ghost" size="sm" icon="refresh" onClick={clearBet} disabled={bet === 0}>
                      Clear
                    </Button>
                    <Button variant="ghost" size="sm" icon="up" onClick={setMax} disabled={balance === 0}>
                      Max
                    </Button>
                    <span className="bj-bet__range num">
                      {MIN_BET}–{MAX_BET} VC
                    </span>
                  </div>
                </div>

                <div className="bj-go">
                  <Button
                    variant="gold"
                    size="lg"
                    block
                    icon={settled ? 'refresh' : 'play'}
                    onClick={() => startGame(bet)}
                    disabled={!canDeal}
                  >
                    {settled ? 'Deal again' : 'Deal cards'}
                    {bet > 0 && ` · ${bet} VC`}
                  </Button>
                  {settled && (
                    <a className="btn btn--outline btn--lg" href="#/history">
                      <Icon name="history" size={16} />
                      <span>See history</span>
                    </a>
                  )}
                </div>

                {!affordable && (
                  <p className="bj-hint bj-hint--warn">
                    <Icon name="info" size={15} />
                    Your stake is higher than your balance. Lower it, or claim a
                    free top-up.
                  </p>
                )}
              </>
            )}

            <ProgressBarBlock onOpenRules={() => setRulesOpen(true)} />
          </Panel>
        </div>
      </main>

      <Modal open={rulesOpen} onClose={() => setRulesOpen(false)} title="Blackjack rules">
        <div className="modal__prose">
          <p>
            Get closer to 21 than the dealer without going over. Number cards are
            face value, picture cards are 10, and an Ace counts as 11 or 1.
          </p>
          <ul>
            <li>Six decks; the dealer stands on all 17s.</li>
            <li>A two-card 21 is a natural blackjack and pays 3:2.</li>
            <li>A win pays 1:1; a push returns your stake.</li>
            <li>Double down on your first two cards for one extra card.</li>
            <li>Split pairs up to four hands; split Aces get one card each.</li>
            <li>Blackjack pays 3:2, rounded down to a whole credit.</li>
          </ul>
          <p className="modal__footnote">
            All stakes and payouts are in virtual credits, which have no monetary
            value and cannot be redeemed.
          </p>
        </div>
      </Modal>

      <SiteFooter />
    </>
  )
}

/** Small XP meter shown under the console. */
function ProgressBarBlock({ onOpenRules }: { onOpenRules: () => void }) {
  const { level: info } = useApp()
  return (
    <div className="bj-progress">
      <div className="bj-progress__meter">
        <div className="bj-progress__row">
          <span className="eyebrow eyebrow--muted">
            Level {info.level} · {info.intoLevel} / {info.needed} XP
          </span>
          <a className="link" href="#/rewards">
            Rewards →
          </a>
        </div>
        <ProgressBar value={info.intoLevel} max={info.needed} label="Experience" />
      </div>
      <button type="button" className="link" onClick={onOpenRules}>
        View rules
      </button>
    </div>
  )
}
