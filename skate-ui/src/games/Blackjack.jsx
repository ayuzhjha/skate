/* Royale Blackjack, settled by the server.
 *
 * The client renders the server's hand state machine and only sends
 * actions: deal -> (insurance/decline when offered) -> hit/stand/double/
 * surrender/split -> settled. Cards, totals, dealer play and payouts all
 * come from the server response; nothing is computed locally. The hole
 * card arrives as {rank: "?", suit: "?"} until settle.
 *
 * Two server quirks are handled here (not fixed in server/):
 *  - deal() returns a pre-payout top-level balance for immediately-settled
 *    hands (natural blackjack); result.balance is the correct one, so a
 *    settled view always prefers result.balance.
 *  - the public view does not expose a `doubled` flag, so the 2× tag is
 *    shown whenever a hand's stake exceeds the deal stake.
 */

import { useState, useRef } from 'react';
import { useStore } from '../hooks';
import { api, newIdempotency } from '../api';
import {
  getState,
  saveState,
  applyServerBalance,
  recordLocalGameResult,
  handleGameError,
  playSound,
  triggerHaptic,
  triggerWinVibration,
  showToast,
  updateMissionProgress
} from '../store';

const RED_SUITS = ['♥', '♦'];

function cardValue(rank) {
  if (rank === 'A') return 11;
  if (rank === 'K' || rank === 'Q' || rank === 'J') return 10;
  const n = parseInt(rank, 10);
  return Number.isNaN(n) ? 0 : n;
}

// Visible-only dealer total while the hole card is hidden (server sends
// total: null then). Mirrors the old local display, which skipped the hole.
function visibleDealerTotal(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.rank === '?') continue;
    total += cardValue(c.rank);
    if (c.rank === 'A') aces += 1;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

export default function BlackjackGame({ stake }) {
  const state = useStore();
  const [handId, setHandId] = useState(null);
  const [dealerCards, setDealerCards] = useState([]);
  const [dealerTotal, setDealerTotal] = useState(null);
  const [playerHands, setPlayerHands] = useState([]);
  const [activeHandIdx, setActiveHandIdx] = useState(0);
  const [gameStatus, setGameStatus] = useState('idle'); // 'idle' | 'insurance' | 'player_turn' | 'resolved'
  const [insuranceStake, setInsuranceStake] = useState(0);
  const [resultMsg, setResultMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef(null);
  // Hand ids already recorded in local stats, so a settled view is never
  // double-counted even if it is re-rendered or re-fetched.
  const settledHandsRef = useRef(new Set());

  // Confetti effect on natural blackjack or win
  const fireConfetti = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const particles = Array.from({ length: 45 }, () => ({
      x: canvas.width / 2,
      y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.7) * 9,
      size: Math.random() * 6 + 3,
      color: ['#00e676', '#facc15', '#38bdf8', '#ffffff'][Math.floor(Math.random() * 4)],
      life: 60,
    }));
    let frame = 0;
    function anim() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2;
        p.life -= 1;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      });
      frame++;
      if (frame < 60) requestAnimationFrame(anim);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    anim();
  };

  // Render a server view into local state. Records the round in local
  // display stats exactly once, when the view first becomes settled.
  const applyView = (view) => {
    setHandId(view.hand_id);
    setDealerCards(view.dealer.cards);
    setDealerTotal(view.dealer.total);
    setPlayerHands(view.player_hands);
    const firstPlaying = view.player_hands.findIndex((h) => h.status === 'playing');
    setActiveHandIdx(firstPlaying >= 0 ? firstPlaying : 0);

    if (view.status === 'awaiting_insurance') {
      setGameStatus('insurance');
      setInsuranceStake(Math.floor((view.player_hands[0]?.stake || 0) / 2));
    } else if (view.status === 'settled') {
      setGameStatus('resolved');
      // Prefer result.balance: deal() returns a stale pre-payout balance
      // for immediately-settled hands (see file header).
      const balance = view.result && typeof view.result.balance === 'number'
        ? view.result.balance
        : view.balance;
      if (typeof balance === 'number') applyServerBalance(balance);

      if (!settledHandsRef.current.has(view.hand_id)) {
        settledHandsRef.current.add(view.hand_id);
        const res = view.result || { hands: [], net: 0, insurance_payout: 0 };
        const staked = view.player_hands.reduce((sum, h) => sum + h.stake, 0)
          + (view.insurance?.stake || 0);
        const totalReturn = res.hands.reduce((sum, h) => sum + h.payout, 0)
          + (res.insurance_payout || 0);
        const anyBlackjack = res.hands.some((h) => h.outcome === 'blackjack');
        recordLocalGameResult('Royale Blackjack', staked, totalReturn, anyBlackjack);
        if (anyBlackjack) {
          const s = getState();
          s.stats.blackjacks += 1;
          saveState();
        }
        const details = res.hands.map((h, i) => {
          const label = res.hands.length > 1 ? `Hand ${i + 1}: ` : '';
          const map = {
            blackjack: 'BLACKJACK 3:2',
            win: `Won ${h.payout} SC`,
            push: 'Push',
            lose: 'Lost',
            surrendered: `Surrendered (${h.payout} SC refund)`,
          };
          return `${label}${map[h.outcome] || h.outcome}`;
        });
        if (res.insurance_payout > 0) details.push('Insurance Won (+2:1)');
        else if (view.insurance?.taken) details.push('Insurance Lost');
        setResultMsg({
          title: anyBlackjack ? '🃏 ROYAL BLACKJACK!' : res.net > 0 ? '🎉 YOU WIN!' : res.net === 0 ? '🤝 PUSH' : 'DEALER WINS',
          net: res.net,
          totalReturn,
          details: details.join(' · '),
        });
        if (anyBlackjack || res.net > 0) {
          fireConfetti();
          triggerWinVibration(anyBlackjack ? 2.5 : 2);
        }
      }
    } else {
      // 'playing'
      setGameStatus('player_turn');
      if (typeof view.balance === 'number') applyServerBalance(view.balance);
    }
  };

  const startHand = async () => {
    if (busy || (gameStatus !== 'idle' && gameStatus !== 'resolved')) return;
    if (state.credits < stake) {
      showToast('Insufficient virtual credits!', 'danger');
      return;
    }
    setResultMsg(null);
    setInsuranceStake(0);
    setBusy(true);
    try {
      const view = await api.blackjackDeal(stake, newIdempotency());
      applyView(view);
      playSound('card');
      triggerHaptic(18);
    } catch (err) {
      await handleGameError(err);
    } finally {
      setBusy(false);
    }
  };

  const playerAction = async (act) => {
    if (busy || !handId) return;
    if (gameStatus === 'insurance') {
      if (act !== 'insurance' && act !== 'decline_insurance') return;
    } else if (gameStatus !== 'player_turn') {
      return;
    }
    setBusy(true);
    try {
      const view = await api.blackjackAction(handId, act);
      if (act === 'double') updateMissionProgress('m_double1', 1);
      applyView(view);
      if (act === 'hit' || act === 'split') playSound('card');
      if (act === 'double') {
        playSound('chip');
        playSound('card');
      }
      triggerHaptic(12);
    } catch (err) {
      // Illegal action or server error: show the server message, refresh
      // the wallet, and leave the hand state untouched.
      await handleGameError(err);
    } finally {
      setBusy(false);
    }
  };

  const currentHand = playerHands[activeHandIdx] || playerHands[0];
  // A hand with exactly 2 cards in 'playing' status is on its first action:
  // hit always adds a card, stand/double/surrender all end the hand.
  const isFirstAction = currentHand && currentHand.status === 'playing' && currentHand.cards.length === 2;
  const canDouble = gameStatus === 'player_turn' && isFirstAction && state.credits >= currentHand.stake;
  const canSplit = gameStatus === 'player_turn' && playerHands.length === 1 && isFirstAction
    && currentHand.cards[0].rank === currentHand.cards[1].rank && state.credits >= currentHand.stake;
  const canSurrender = gameStatus === 'player_turn' && playerHands.length === 1 && isFirstAction;
  const dealerShownTotal = dealerTotal !== null && dealerTotal !== undefined
    ? dealerTotal
    : (dealerCards.length === 0 ? '--' : visibleDealerTotal(dealerCards));
  const dealerIsBj = dealerTotal === 21 && dealerCards.length === 2;
  const playerShownTotal = currentHand ? currentHand.total : '--';
  const playerIsBj = currentHand && currentHand.total === 21 && currentHand.cards.length === 2 && gameStatus === 'resolved';

  const renderCard = (c, i, hidden) => (
    <div
      key={i}
      className={`playing-card ${hidden ? 'card-back' : RED_SUITS.includes(c.suit) ? 'card-red' : 'card-black'}`}
      style={{
        width: 74, height: 108, borderRadius: 10,
        background: hidden ? 'linear-gradient(135deg, #1f2937, #0f172a)' : '#ffffff',
        border: hidden ? '1.5px solid rgba(212, 168, 67, 0.4)' : '1.5px solid rgba(0,0,0,0.2)',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '8px 10px', color: hidden ? '#ffffff' : RED_SUITS.includes(c.suit) ? '#e74c3c' : '#111827',
        boxShadow: '0 6px 18px rgba(0,0,0,0.35)', position: 'relative',
        animation: 'cardDeal 0.25s ease backwards'
      }}
    >
      {hidden ? (
        <div style={{ margin: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <img src="/avatar-skate.svg" alt="Card Back" style={{ width: 28, height: 28, opacity: 0.8 }} />
          <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--gold)', letterSpacing: 0.5 }}>SKATE</span>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 16, fontWeight: 900, lineHeight: 1 }}>{c.rank}</div>
          <div style={{ fontSize: 26, textAlign: 'center', lineHeight: 1 }}>{c.suit}</div>
          <div style={{ fontSize: 16, fontWeight: 900, lineHeight: 1, textAlign: 'right' }}>{c.rank}</div>
        </>
      )}
    </div>
  );

  return (
    <div className="game-stage active" style={{ position: 'relative' }}>
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          pointerEvents: 'none', zIndex: 15
        }}
      />

      {/* Insurance Prompt Banner */}
      {gameStatus === 'insurance' && (
        <div className="card" style={{
          background: 'rgba(212, 168, 67, 0.15)', borderColor: 'var(--gold)',
          textAlign: 'center', marginBottom: 14, padding: 14
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', marginBottom: 8 }}>
            🛡️ Dealer shows an Ace! Buy Insurance for {insuranceStake} SC?
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Pays 2:1 if Dealer has natural 21 Blackjack
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn btn-gold btn-sm" onClick={() => playerAction('insurance')} disabled={busy}>
              Buy Insurance ({insuranceStake} SC)
            </button>
            <button className="btn btn-surface btn-sm" onClick={() => playerAction('decline_insurance')} disabled={busy}>
              Decline
            </button>
          </div>
        </div>
      )}

      {/* Table Felt Board with Metallic Gold Border */}
      <div className="blackjack-felt-table">
        {/* Dealer Zone */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: 1.5 }}>
              Dealer Hand
            </span>
            <span className="bj-hand-score-pill">
              {dealerCards.length === 0 ? '--' : dealerIsBj ? 'BJ 21' : dealerShownTotal}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 10, minHeight: 112, alignItems: 'center', justifyContent: 'center' }}>
            {dealerCards.length === 0 ? (
              <div className="bj-watermark-placeholder">
                <svg width="44" height="44" viewBox="0 0 44 44" fill="none" opacity="0.3">
                  <rect x="6" y="8" width="22" height="30" rx="3" stroke="#ffffff" strokeWidth="1.5" transform="rotate(-10 6 8)" />
                  <rect x="16" y="6" width="22" height="30" rx="3" stroke="#ffffff" strokeWidth="1.5" transform="rotate(10 16 6)" />
                  <path d="M 27 19 C 25 16 23 18 21 15 C 19 18 17 16 15 19 C 14 21 16 23 18 24 L 21 27 L 24 24 C 26 23 28 21 27 19 Z" fill="#ffffff" />
                </svg>
                <div className="bj-watermark-text">
                  Cards dealt after placing wager...
                </div>
              </div>
            ) : (
              dealerCards.map((c, i) => renderCard(c, i, c.rank === '?'))
            )}
          </div>
        </div>

        {/* Center Felt Markings */}
        <div className="bj-center-rule-row">
          <div className="bj-rule-line" />
          <div className="bj-rule-text">
            BLACKJACK PAYS 3 TO 2 · DEALER MUST STAND ON 17
          </div>
          <div className="bj-rule-line" />
        </div>

        {/* Player Zone */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: 1.5 }}>
                Your Hand {playerHands.length > 1 && `(${activeHandIdx + 1}/${playerHands.length})`}
              </span>
              {currentHand && currentHand.stake > stake && (
                <span className="tag tag-gold" style={{ fontSize: 10, padding: '2px 6px' }}>2× Doubled</span>
              )}
            </div>
            <span className="bj-hand-score-pill">
              {playerHands.length === 0 ? '--' : playerIsBj ? 'BJ 21' : playerShownTotal}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            {playerHands.length === 0 ? (
              <div className="bj-watermark-placeholder">
                <svg width="44" height="44" viewBox="0 0 44 44" fill="none" opacity="0.3">
                  <rect x="6" y="8" width="22" height="30" rx="3" stroke="#ffffff" strokeWidth="1.5" transform="rotate(-10 6 8)" />
                  <rect x="16" y="6" width="22" height="30" rx="3" stroke="#ffffff" strokeWidth="1.5" transform="rotate(10 16 6)" />
                  <path d="M 27 19 C 25 16 23 18 21 15 C 19 18 17 16 15 19 C 14 21 16 23 18 24 L 21 27 L 24 24 C 26 23 28 21 27 19 Z" fill="#ffffff" />
                </svg>
                <div className="bj-watermark-text">
                  Tap Deal Hand to start round...
                </div>
              </div>
            ) : (
              playerHands.map((h, hIdx) => (
                <div
                  key={hIdx}
                  style={{
                    display: 'flex', gap: 10, padding: 6, borderRadius: 12,
                    border: hIdx === activeHandIdx && gameStatus === 'player_turn' ? '1.5px solid var(--emerald)' : '1px solid transparent',
                    background: hIdx === activeHandIdx && gameStatus === 'player_turn' ? 'rgba(0, 230, 118, 0.08)' : 'transparent'
                  }}
                >
                  {h.cards.map((c, i) => renderCard(c, `${hIdx}-${i}`, false))}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Result Callout if resolved */}
      {resultMsg && (
        <div className="card" style={{
          textAlign: 'center', marginBottom: 14, padding: 14,
          borderColor: resultMsg.net > 0 ? 'var(--emerald)' : resultMsg.net === 0 ? 'var(--border)' : 'var(--red)',
          background: resultMsg.net > 0 ? 'rgba(0, 230, 118, 0.08)' : 'rgba(231, 76, 60, 0.08)'
        }}>
          <div style={{
            fontSize: 16, fontWeight: 800,
            color: resultMsg.net > 0 ? 'var(--emerald)' : resultMsg.net === 0 ? 'var(--text-secondary)' : 'var(--red)'
          }}>
            {resultMsg.title}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            {resultMsg.details}
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 800, marginTop: 6,
            color: resultMsg.net > 0 ? 'var(--emerald)' : resultMsg.net === 0 ? 'var(--text-secondary)' : 'var(--red)'
          }}>
            {resultMsg.net >= 0 ? `+${resultMsg.net.toLocaleString()}` : resultMsg.net.toLocaleString()} SC
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
        {gameStatus === 'player_turn' ? (
          <>
            <button className="btn btn-primary" onClick={() => playerAction('hit')} disabled={busy}>
              Hit
            </button>
            <button className="btn btn-secondary" onClick={() => playerAction('stand')} disabled={busy}>
              Stand
            </button>
            <button className="btn btn-gold" onClick={() => playerAction('double')} disabled={busy || !canDouble}>
              2× Double
            </button>
            <button className="btn btn-surface" onClick={() => playerAction('split')} disabled={busy || !canSplit}>
              Split
            </button>
          </>
        ) : (
          <button
            className="btn-deal-hand-primary"
            style={{ gridColumn: 'span 4' }}
            onClick={startHand}
            disabled={busy || gameStatus === 'insurance'}
          >
            <span style={{ fontSize: 20 }}>🃏</span>
            <span>{busy ? 'Dealing…' : gameStatus === 'resolved' ? 'Deal Next Hand' : 'Deal Hand'}</span>
          </button>
        )}
      </div>

      {/* Secondary Actions if in player turn */}
      {gameStatus === 'player_turn' && canSurrender && (
        <div style={{ textAlign: 'center' }}>
          <button
            className="btn btn-surface btn-sm"
            onClick={() => playerAction('surrender')}
            disabled={busy}
            style={{ fontSize: 11, color: 'var(--text-dim)' }}
          >
            Surrender (Forfeit 50% Stake)
          </button>
        </div>
      )}
    </div>
  );
}
