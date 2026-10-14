import { useState, useEffect, useRef } from 'react';
import { useStore } from '../hooks';
import {
  getState,
  saveState,
  recordTransaction,
  recordGameOutcome,
  nextProvablyFairFloat,
  playSound,
  triggerHaptic,
  triggerWinVibration,
  showToast,
  updateMissionProgress
} from '../store';

const SUITS = [
  { symbol: '♠', color: 'black', name: 'spades' },
  { symbol: '♥', color: 'red', name: 'hearts' },
  { symbol: '♦', color: 'red', name: 'diamonds' },
  { symbol: '♣', color: 'black', name: 'clubs' },
];

const RANKS = [
  { rank: '2', val: 2 },
  { rank: '3', val: 3 },
  { rank: '4', val: 4 },
  { rank: '5', val: 5 },
  { rank: '6', val: 6 },
  { rank: '7', val: 7 },
  { rank: '8', val: 8 },
  { rank: '9', val: 9 },
  { rank: '10', val: 10 },
  { rank: 'J', val: 10 },
  { rank: 'Q', val: 10 },
  { rank: 'K', val: 10 },
  { rank: 'A', val: 11 },
];

function buildShoe() {
  const shoe = [];
  for (let d = 0; d < 6; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        shoe.push({ ...suit, ...rank, id: `${d}-${suit.symbol}-${rank.rank}-${Math.random()}` });
      }
    }
  }
  // Seeded Fisher-Yates shuffle
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = Math.floor(nextProvablyFairFloat() * (i + 1));
    const tmp = shoe[i];
    shoe[i] = shoe[j];
    shoe[j] = tmp;
  }
  return shoe;
}

export function evaluateHand(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.hidden) continue;
    total += c.val;
    if (c.rank === 'A') aces += 1;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  const isBlackjack = cards.length === 2 && total === 21 && !cards.some(c => c.hidden);
  const isBust = total > 21;
  return { total, isBlackjack, isBust, isSoft: aces > 0 && total <= 21 };
}

export default function BlackjackGame({ stake }) {
  const state = useStore();
  const [shoe, setShoe] = useState([]);
  const [dealerHand, setDealerHand] = useState([]);
  const [playerHands, setPlayerHands] = useState([]);
  const [activeHandIdx, setActiveHandIdx] = useState(0);
  const [gameStatus, setGameStatus] = useState('idle'); // 'idle' | 'insurance' | 'player_turn' | 'dealer_turn' | 'resolved'
  const [insuranceBet, setInsuranceBet] = useState(0);
  const [resultMsg, setResultMsg] = useState(null);
  const canvasRef = useRef(null);

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

  const drawCard = (currentShoe) => {
    let s = currentShoe;
    if (!s || s.length < 15) {
      s = buildShoe();
    }
    const card = s.pop();
    setShoe([...s]);
    return { card, newShoe: s };
  };

  const startHand = () => {
    if (gameStatus !== 'idle' && gameStatus !== 'resolved') return;
    if (state.credits < stake) {
      showToast('Insufficient virtual credits!', 'danger');
      return;
    }

    setResultMsg(null);
    setInsuranceBet(0);
    setActiveHandIdx(0);

    let curShoe = shoe.length > 20 ? [...shoe] : buildShoe();

    // Deduct stake
    recordTransaction('bet', `Blackjack Wager (Nonce #${state.fairness.nonce + 1})`, -stake, `Stake: ${stake} SC`);
    state.fairness.nonce += 1;
    saveState();

    const d1 = curShoe.pop();
    const p1 = curShoe.pop();
    const d2 = { ...curShoe.pop(), hidden: true };
    const p2 = curShoe.pop();
    setShoe(curShoe);

    const initPlayerHand = [{ cards: [p1, p2], stake, status: 'playing', doubled: false }];
    const initDealerHand = [d1, d2];
    setDealerHand(initDealerHand);
    setPlayerHands(initPlayerHand);

    playSound('card');
    triggerHaptic(18);

    const pEval = evaluateHand([p1, p2]);

    // Check dealer Ace for insurance
    if (d1.rank === 'A' && state.credits >= Math.floor(stake / 2) && !pEval.isBlackjack) {
      setGameStatus('insurance');
    } else {
      checkInitialBlackjacks([p1, p2], initDealerHand, initPlayerHand);
    }
  };

  const handleInsurance = (buy) => {
    const cost = Math.floor(stake / 2);
    if (buy && state.credits >= cost) {
      setInsuranceBet(cost);
      recordTransaction('bet', `Insurance Bet (Nonce #${state.fairness.nonce})`, -cost, '2:1 Insurance');
      playSound('chip');
    }
    checkInitialBlackjacks(playerHands[0].cards, dealerHand, playerHands, buy ? cost : 0);
  };

  const checkInitialBlackjacks = (playerCards, currentDealerHand, currentHands, currentIns = insuranceBet) => {
    const pEval = evaluateHand(playerCards);
    const unhiddenDealer = currentDealerHand.map(c => ({ ...c, hidden: false }));
    const dEval = evaluateHand(unhiddenDealer);

    if (pEval.isBlackjack || dEval.isBlackjack) {
      settleHands(currentDealerHand, currentHands, currentIns);
    } else {
      setGameStatus('player_turn');
    }
  };

  const playerAction = (act) => {
    if (gameStatus !== 'player_turn') return;
    const hand = playerHands[activeHandIdx];
    if (!hand) return;

    if (act === 'hit') {
      const { card } = drawCard(shoe);
      const updatedCards = [...hand.cards, card];
      const ev = evaluateHand(updatedCards);
      const updatedHands = [...playerHands];
      updatedHands[activeHandIdx] = {
        ...hand,
        cards: updatedCards,
        status: ev.isBust ? 'bust' : ev.total === 21 ? 'stood' : 'playing',
      };
      setPlayerHands(updatedHands);
      playSound('card');
      triggerHaptic(12);

      if (ev.isBust || ev.total === 21) {
        advanceHand(updatedHands, activeHandIdx);
      }
    } else if (act === 'stand') {
      triggerHaptic(10);
      const updatedHands = [...playerHands];
      updatedHands[activeHandIdx] = { ...hand, status: 'stood' };
      setPlayerHands(updatedHands);
      advanceHand(updatedHands, activeHandIdx);
    } else if (act === 'double') {
      if (hand.cards.length !== 2 || state.credits < hand.stake) {
        showToast('Requires initial 2 cards & sufficient balance!', 'danger');
        return;
      }
      recordTransaction('bet', `Double Down (Nonce #${state.fairness.nonce})`, -hand.stake, '2× Stake');
      updateMissionProgress('m_double1', 1);

      const { card } = drawCard(shoe);
      const updatedCards = [...hand.cards, card];
      const ev = evaluateHand(updatedCards);
      const updatedHands = [...playerHands];
      updatedHands[activeHandIdx] = {
        ...hand,
        cards: updatedCards,
        stake: hand.stake * 2,
        doubled: true,
        status: ev.isBust ? 'bust' : 'stood',
      };
      setPlayerHands(updatedHands);
      playSound('chip');
      playSound('card');
      advanceHand(updatedHands, activeHandIdx);
    } else if (act === 'split') {
      if (playerHands.length > 1 || hand.cards.length !== 2 || hand.cards[0].val !== hand.cards[1].val || state.credits < hand.stake) {
        showToast('Can only split identical value initial pair!', 'danger');
        return;
      }
      recordTransaction('bet', `Split Pair (Nonce #${state.fairness.nonce})`, -hand.stake, 'Split Hand');
      const { card: c1 } = drawCard(shoe);
      const { card: c2 } = drawCard(shoe);
      const splitHand1 = { cards: [hand.cards[0], c1], stake: hand.stake, status: 'playing', doubled: false };
      const splitHand2 = { cards: [hand.cards[1], c2], stake: hand.stake, status: 'playing', doubled: false };
      setPlayerHands([splitHand1, splitHand2]);
      playSound('card');
    } else if (act === 'surrender') {
      if (hand.cards.length !== 2 || playerHands.length > 1) return;
      const updatedHands = [{ ...hand, status: 'surrendered' }];
      setPlayerHands(updatedHands);
      advanceHand(updatedHands, activeHandIdx);
    }
  };

  const advanceHand = (currentHands, currentIdx) => {
    if (currentIdx + 1 < currentHands.length) {
      setActiveHandIdx(currentIdx + 1);
    } else {
      dealerTurnAndSettle(currentHands);
    }
  };

  const dealerTurnAndSettle = (currentHands) => {
    setGameStatus('dealer_turn');
    let dHand = dealerHand.map(c => ({ ...c, hidden: false }));
    const hasLivePlayer = currentHands.some(h => h.status === 'stood');

    let curShoe = [...shoe];
    if (hasLivePlayer) {
      let dEval = evaluateHand(dHand);
      while (dEval.total < 17) {
        if (curShoe.length < 5) curShoe = buildShoe();
        const nextCard = curShoe.pop();
        dHand.push(nextCard);
        dEval = evaluateHand(dHand);
      }
      setShoe(curShoe);
    }
    setDealerHand(dHand);
    settleHands(dHand, currentHands, insuranceBet);
  };

  const settleHands = (finalDealerHand, finalPlayerHands, currentIns) => {
    const revealedDealer = finalDealerHand.map(c => ({ ...c, hidden: false }));
    setDealerHand(revealedDealer);
    const dEval = evaluateHand(revealedDealer);

    let totalStaked = 0;
    let totalReturn = 0;
    let anyWin = false;
    let anyBlackjack = false;
    let details = [];

    // Check Insurance
    if (currentIns > 0) {
      totalStaked += currentIns;
      if (dEval.isBlackjack) {
        totalReturn += currentIns * 3;
        details.push('Insurance Won (+2:1)');
      } else {
        details.push('Insurance Lost');
      }
    }

    finalPlayerHands.forEach((h, i) => {
      totalStaked += h.stake;
      const pEval = evaluateHand(h.cards);
      const label = finalPlayerHands.length > 1 ? `Hand ${i + 1}: ` : '';

      if (h.status === 'surrendered') {
        const refund = Math.floor(h.stake / 2);
        totalReturn += refund;
        details.push(`${label}Surrendered (${refund} SC refund)`);
      } else if (pEval.isBlackjack) {
        if (dEval.isBlackjack) {
          totalReturn += h.stake;
          details.push(`${label}Push (Both Blackjack)`);
        } else {
          const payout = Math.round(h.stake * 2.5);
          totalReturn += payout;
          anyWin = true;
          anyBlackjack = true;
          const s = getState();
          s.stats.blackjacks += 1;
          saveState();
          details.push(`${label}BLACKJACK 3:2 (+${payout} SC)`);
        }
      } else if (pEval.isBust) {
        details.push(`${label}Busted (${pEval.total})`);
      } else if (dEval.isBust) {
        const payout = h.stake * 2;
        totalReturn += payout;
        anyWin = true;
        details.push(`${label}Dealer Busts! Won ${payout} SC`);
      } else if (pEval.total > dEval.total) {
        const payout = h.stake * 2;
        totalReturn += payout;
        anyWin = true;
        details.push(`${label}Won ${payout} SC (${pEval.total} vs ${dEval.total})`);
      } else if (pEval.total < dEval.total) {
        details.push(`${label}Lost (${pEval.total} vs ${dEval.total})`);
      } else {
        totalReturn += h.stake;
        details.push(`${label}Push (${pEval.total})`);
      }
    });

    setGameStatus('resolved');
    recordGameOutcome('Royale Blackjack', totalStaked, totalReturn, details.join(', '), anyBlackjack);

    const net = totalReturn - totalStaked;
    if (anyBlackjack || net > 0) {
      fireConfetti();
      triggerWinVibration(anyBlackjack ? 2.5 : 2);
    }

    setResultMsg({
      title: anyBlackjack ? '🃏 ROYAL BLACKJACK!' : net > 0 ? '🎉 YOU WIN!' : net === 0 ? '🤝 PUSH' : 'DEALER WINS',
      net,
      totalReturn,
      details: details.join(' · '),
    });
  };

  const dealerEval = evaluateHand(dealerHand);
  const currentHand = playerHands[activeHandIdx] || playerHands[0];
  const playerEval = currentHand ? evaluateHand(currentHand.cards) : { total: 0 };

  const canDouble = gameStatus === 'player_turn' && currentHand && currentHand.cards.length === 2 && state.credits >= currentHand.stake;
  const canSplit = gameStatus === 'player_turn' && playerHands.length === 1 && currentHand && currentHand.cards.length === 2 && currentHand.cards[0].val === currentHand.cards[1].val && state.credits >= currentHand.stake;
  const canSurrender = gameStatus === 'player_turn' && playerHands.length === 1 && currentHand && currentHand.cards.length === 2;

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
            🛡️ Dealer shows an Ace! Buy Insurance for {Math.floor(stake / 2)} SC?
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Pays 2:1 if Dealer has natural 21 Blackjack
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn btn-gold btn-sm" onClick={() => handleInsurance(true)}>
              Buy Insurance ({Math.floor(stake / 2)} SC)
            </button>
            <button className="btn btn-surface btn-sm" onClick={() => handleInsurance(false)}>
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
              {dealerHand.length === 0 ? '--' : dealerEval.isBlackjack ? 'BJ 21' : dealerEval.total}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 10, minHeight: 112, alignItems: 'center', justifyContent: 'center' }}>
            {dealerHand.length === 0 ? (
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
              dealerHand.map((c, i) => (
                <div
                  key={c.id || i}
                  className={`playing-card ${c.hidden ? 'card-back' : c.color === 'red' ? 'card-red' : 'card-black'}`}
                  style={{
                    width: 74, height: 108, borderRadius: 10,
                    background: c.hidden ? 'linear-gradient(135deg, #1f2937, #0f172a)' : '#ffffff',
                    border: c.hidden ? '1.5px solid rgba(212, 168, 67, 0.4)' : '1.5px solid rgba(0,0,0,0.2)',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                    padding: '8px 10px', color: c.hidden ? '#ffffff' : c.color === 'red' ? '#e74c3c' : '#111827',
                    boxShadow: '0 6px 18px rgba(0,0,0,0.35)', position: 'relative',
                    animation: 'cardDeal 0.25s ease backwards'
                  }}
                >
                  {c.hidden ? (
                    <div style={{ margin: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <img src="/avatar-skate.svg" alt="Card Back" style={{ width: 28, height: 28, opacity: 0.8 }} />
                      <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--gold)', letterSpacing: 0.5 }}>SKATE</span>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: 16, fontWeight: 900, lineHeight: 1 }}>{c.rank}</div>
                      <div style={{ fontSize: 26, textAlign: 'center', lineHeight: 1 }}>{c.symbol}</div>
                      <div style={{ fontSize: 16, fontWeight: 900, lineHeight: 1, textAlign: 'right' }}>{c.rank}</div>
                    </>
                  )}
                </div>
              ))
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
              {currentHand && currentHand.doubled && (
                <span className="tag tag-gold" style={{ fontSize: 10, padding: '2px 6px' }}>2× Doubled</span>
              )}
            </div>
            <span className="bj-hand-score-pill">
              {playerHands.length === 0 ? '--' : playerEval.isBlackjack ? 'BJ 21' : playerEval.total}
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
                  {h.cards.map((c, i) => (
                    <div
                      key={c.id || i}
                      className={`playing-card ${c.color === 'red' ? 'card-red' : 'card-black'}`}
                      style={{
                        width: 74, height: 108, borderRadius: 10,
                        background: '#ffffff',
                        border: '1.5px solid rgba(0,0,0,0.2)',
                        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                        padding: '8px 10px', color: c.color === 'red' ? '#e74c3c' : '#111827',
                        boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
                        animation: 'cardDeal 0.25s ease backwards'
                      }}
                    >
                      <div style={{ fontSize: 16, fontWeight: 900, lineHeight: 1 }}>{c.rank}</div>
                      <div style={{ fontSize: 26, textAlign: 'center', lineHeight: 1 }}>{c.symbol}</div>
                      <div style={{ fontSize: 16, fontWeight: 900, lineHeight: 1, textAlign: 'right' }}>{c.rank}</div>
                    </div>
                  ))}
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
            <button className="btn btn-primary" onClick={() => playerAction('hit')}>
              Hit
            </button>
            <button className="btn btn-secondary" onClick={() => playerAction('stand')}>
              Stand
            </button>
            <button className="btn btn-gold" onClick={() => playerAction('double')} disabled={!canDouble}>
              2× Double
            </button>
            <button className="btn btn-surface" onClick={() => playerAction('split')} disabled={!canSplit}>
              Split
            </button>
          </>
        ) : (
          <button
            className="btn-deal-hand-primary"
            style={{ gridColumn: 'span 4' }}
            onClick={startHand}
            disabled={gameStatus === 'insurance' || gameStatus === 'dealer_turn'}
          >
            <span style={{ fontSize: 20 }}>🃏</span>
            <span>{gameStatus === 'resolved' ? 'Deal Next Hand' : 'Deal Hand'}</span>
          </button>
        )}
      </div>

      {/* Secondary Actions if in player turn */}
      {gameStatus === 'player_turn' && canSurrender && (
        <div style={{ textAlign: 'center' }}>
          <button
            className="btn btn-surface btn-sm"
            onClick={() => playerAction('surrender')}
            style={{ fontSize: 11, color: 'var(--text-dim)' }}
          >
            Surrender (Forfeit 50% Stake)
          </button>
        </div>
      )}
    </div>
  );
}
