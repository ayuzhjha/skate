import { useState } from 'react';
import { useStore } from '../hooks';
import {
  recordTransaction,
  recordGameOutcome,
  nextProvablyFairFloat,
  playSound,
  triggerHaptic,
  triggerWinVibration,
  showToast
} from '../store';

export default function DiceGame({ stake }) {
  const state = useStore();
  const [mode, setMode] = useState('over'); // 'over' | 'under'
  const [target, setTarget] = useState(50);
  const [rolling, setRolling] = useState(false);
  const [rollResult, setRollResult] = useState(50.0);
  const [lastWon, setLastWon] = useState(null);

  const winChance = mode === 'over' ? 100 - target : target;
  const multiplier = +(99.0 / Math.max(1, winChance)).toFixed(2);
  const potentialPayout = Math.round(stake * multiplier);

  const rollDice = () => {
    if (rolling) return;
    if (state.credits < stake) {
      showToast('Insufficient virtual credits!', 'danger');
      return;
    }

    setRolling(true);
    setLastWon(null);

    // Record bet
    recordTransaction('bet', `Neon Dice (${mode.toUpperCase()} ${target})`, -stake, `Stake: ${stake} SC`);
    playSound('chip');

    // Provably fair roll float (0.00 to 100.00)
    const finalRoll = +(nextProvablyFairFloat() * 100).toFixed(2);

    let count = 0;
    const interval = setInterval(() => {
      setRollResult(+(Math.random() * 100).toFixed(2));
      playSound('card');
      count++;
      if (count >= 12) {
        clearInterval(interval);
        setRollResult(finalRoll);
        setRolling(false);

        const won = mode === 'over' ? finalRoll > target : finalRoll < target;
        setLastWon(won);

        const payout = won ? Math.round(stake * multiplier) : 0;
        recordGameOutcome('Neon Dice', stake, payout, `Rolled ${finalRoll.toFixed(2)} (${mode.toUpperCase()} ${target})`);

        if (won) {
          playSound('win');
          triggerWinVibration(multiplier);
          showToast(`🎲 Rolled ${finalRoll.toFixed(2)}! Won ${payout.toLocaleString()} SC (${multiplier}×)`, 'gold');
        } else {
          playSound('loss');
          triggerHaptic(25);
        }
      }
    }, 45);
  };

  // Slider background showing Win (Emerald) vs Loss (Red) zones
  const sliderBackground = mode === 'over'
    ? `linear-gradient(to right, #e74c3c 0%, #e74c3c ${target}%, #2ecc71 ${target}%, #2ecc71 100%)`
    : `linear-gradient(to right, #2ecc71 0%, #2ecc71 ${target}%, #e74c3c ${target}%, #e74c3c 100%)`;

  return (
    <div className="game-stage active">
      {/* Mode Switcher */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <button
          className={`btn ${mode === 'over' ? 'btn-primary' : 'btn-surface'}`}
          onClick={() => !rolling && setMode('over')}
          disabled={rolling}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <img src="/dice.png" alt="Over" style={{ width: 18, height: 18, objectFit: 'contain' }} />
          Roll Over {target}
        </button>
        <button
          className={`btn ${mode === 'under' ? 'btn-gold' : 'btn-surface'}`}
          onClick={() => !rolling && setMode('under')}
          disabled={rolling}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <img src="/dice.png" alt="Under" style={{ width: 18, height: 18, objectFit: 'contain' }} />
          Roll Under {target}
        </button>
      </div>

      {/* Main Dice Console Box */}
      <div style={{
        background: 'var(--bg-elevated)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        padding: '20px 18px',
        textAlign: 'center',
        marginBottom: 16,
        boxShadow: 'inset 0 0 30px rgba(0,0,0,0.5)'
      }}>
        {/* Animated Dice Graphic Showcase */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 16,
          marginBottom: 12
        }}>
          <img
            src="/dice.png"
            alt="Dice 1"
            style={{
              width: 52,
              height: 52,
              objectFit: 'contain',
              filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.5))',
              transform: rolling ? 'rotate(360deg) scale(1.15)' : lastWon === true ? 'scale(1.1)' : 'none',
              transition: rolling ? 'transform 0.15s ease-in-out' : 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              animation: rolling ? 'diceSpin 0.25s infinite linear' : 'none'
            }}
          />
          <img
            src="/dice.png"
            alt="Dice 2"
            style={{
              width: 52,
              height: 52,
              objectFit: 'contain',
              filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.5))',
              transform: rolling ? 'rotate(-360deg) scale(1.15)' : lastWon === true ? 'scale(1.1)' : 'none',
              transition: rolling ? 'transform 0.15s ease-in-out' : 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              animation: rolling ? 'diceSpinRev 0.25s infinite linear' : 'none'
            }}
          />
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1 }}>
          Condition: Roll {mode.toUpperCase()} {target}.00
        </div>

        {/* Big Roll Number Readout */}
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 56,
          fontWeight: 900,
          lineHeight: 1,
          margin: '10px 0 16px 0',
          color: lastWon === true
            ? 'var(--emerald)'
            : lastWon === false
            ? 'var(--red)'
            : '#ffffff',
          textShadow: lastWon === true
            ? '0 0 26px rgba(46, 204, 113, 0.5)'
            : lastWon === false
            ? '0 0 26px rgba(231, 76, 60, 0.5)'
            : 'none',
          transition: 'color 0.2s ease, transform 0.2s ease',
          transform: rolling ? 'scale(0.96)' : 'scale(1)'
        }}>
          {rollResult.toFixed(2)}
        </div>

        {/* Dynamic Dual-Color Range Slider */}
        <div style={{ marginBottom: 14 }}>
          <div style={{
            position: 'relative',
            height: 12,
            borderRadius: 6,
            background: sliderBackground,
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)',
            marginBottom: 8
          }}>
            <input
              type="range"
              min="5"
              max="95"
              step="1"
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
              disabled={rolling}
              style={{
                position: 'absolute',
                top: -5,
                left: 0,
                width: '100%',
                height: 22,
                opacity: 0.9,
                cursor: rolling ? 'default' : 'pointer',
                accentColor: '#ffffff'
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>
            <span style={{ color: mode === 'under' ? 'var(--emerald)' : 'var(--red)' }}>5.00 (Min)</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 800 }}>Target: {target}.00</span>
            <span style={{ color: mode === 'over' ? 'var(--emerald)' : 'var(--red)' }}>95.00 (Max)</span>
          </div>
        </div>

        {/* Quick Target Presets */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 16 }}>
          {[25, 50, 75].map(val => (
            <button
              key={val}
              className="btn btn-surface btn-sm"
              onClick={() => !rolling && setTarget(val)}
              disabled={rolling}
              style={{
                padding: '4px 12px', fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700,
                border: target === val ? '1.5px solid var(--gold)' : '1px solid var(--border)'
              }}
            >
              {val}.00
            </button>
          ))}
        </div>

        {/* Odds & Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
          background: 'var(--bg-card)',
          padding: '12px 10px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)'
        }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>Multiplier</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 800, color: 'var(--gold)' }}>
              {multiplier}×
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>Win Chance</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 800, color: 'var(--emerald)' }}>
              {winChance}%
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>Payout</div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 800, color: 'var(--text-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3
            }}>
              <img src="/coin.png" alt="SC" style={{ width: 13, height: 13, objectFit: 'contain' }} />
              {potentialPayout.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Roll Button */}
      <button
        className="btn btn-primary btn-lg"
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        onClick={rollDice}
        disabled={rolling}
      >
        <img
          src="/dice.png"
          alt="Dice"
          style={{
            width: 20, height: 20, objectFit: 'contain',
            animation: rolling ? 'diceSpin 0.3s infinite linear' : 'none'
          }}
        />
        <span>{rolling ? 'Rolling Provably Fair Dice...' : `Roll Dice · Win ${potentialPayout.toLocaleString()} SC`}</span>
      </button>

      {/* CSS Keyframes for dice animations */}
      <style>{`
        @keyframes diceSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes diceSpinRev {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(-360deg); }
        }
      `}</style>
    </div>
  );
}
