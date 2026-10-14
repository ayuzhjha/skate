import { useState, useRef, useEffect } from 'react';
import { useStore } from '../hooks';
import {
  recordTransaction,
  recordGameOutcome,
  playSound,
  triggerHaptic,
  triggerWinVibration,
  showToast
} from '../store';

export default function ReflexGame({ stake }) {
  const state = useStore();
  const [running, setRunning] = useState(false);
  const [turbo, setTurbo] = useState(false);
  const [cursorPos, setCursorPos] = useState(50);
  const [lastOutcome, setLastOutcome] = useState(null);

  const rafRef = useRef(null);
  const stateRef = useRef({ running: false, pos: 50, dir: 1, speed: 1.0, stake });

  const boost = turbo ? 1.25 : 1.0;
  const payOuter = +(1.25 * boost).toFixed(2);
  const payMid = +(2.5 * boost).toFixed(2);
  const payBull = +(8.0 * boost).toFixed(2);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const startGrind = () => {
    if (running) return;
    if (state.credits < stake) {
      showToast('Insufficient virtual credits!', 'danger');
      return;
    }

    setRunning(true);
    setLastOutcome(null);
    stateRef.current = {
      running: true,
      pos: 10,
      dir: 1,
      speed: turbo ? 1.6 : 1.0,
      stake,
    };

    recordTransaction('bet', 'Precision Grind Wager', -stake, `Stake: ${stake} SC`);
    playSound('chip');

    function step() {
      if (!stateRef.current.running) return;
      stateRef.current.pos += stateRef.current.dir * (2.4 * stateRef.current.speed);

      if (stateRef.current.pos >= 98) {
        stateRef.current.pos = 98;
        stateRef.current.dir = -1;
      } else if (stateRef.current.pos <= 2) {
        stateRef.current.pos = 2;
        stateRef.current.dir = 1;
      }

      setCursorPos(stateRef.current.pos);
      rafRef.current = requestAnimationFrame(step);
    }

    rafRef.current = requestAnimationFrame(step);
  };

  const stopGrind = () => {
    if (!stateRef.current.running) return;
    stateRef.current.running = false;
    setRunning(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const p = stateRef.current.pos;
    let mult = 0;
    let zoneTitle = 'Wipeout (0×)';
    let isWin = false;

    if (p >= 46 && p <= 54) {
      mult = payBull;
      zoneTitle = `🎯 BULLSEYE LOCK (${mult}×)!`;
      isWin = true;
    } else if (p >= 35 && p <= 65) {
      mult = payMid;
      zoneTitle = `⚡ Emerald Grind Zone (${mult}×)!`;
      isWin = true;
    } else if (p >= 22 && p <= 78) {
      mult = payOuter;
      zoneTitle = `🛹 Blue Outer Zone (${mult}×)`;
      isWin = true;
    }

    const payout = Math.round(stateRef.current.stake * mult);
    setLastOutcome({ pos: p, mult, payout, zoneTitle, isWin });

    recordGameOutcome('Precision Grind', stateRef.current.stake, payout, `${zoneTitle} @ ${p.toFixed(1)}%`, mult >= 2.5);

    if (isWin) {
      playSound('win');
      triggerWinVibration(mult);
      showToast(`${zoneTitle} Won ${payout.toLocaleString()} SC!`, 'gold');
    } else {
      playSound('loss');
      triggerHaptic(30);
    }
  };

  return (
    <div className="game-stage active">
      {/* Mode & Turbo Switcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Speed Mode:</span>
          <button
            className={`btn btn-sm ${!turbo ? 'btn-primary' : 'btn-surface'}`}
            onClick={() => !running && setTurbo(false)}
            disabled={running}
          >
            Normal (1×)
          </button>
          <button
            className={`btn btn-sm ${turbo ? 'btn-gold' : 'btn-surface'}`}
            onClick={() => !running && setTurbo(true)}
            disabled={running}
          >
            ⚡ Turbo (1.25× Payout)
          </button>
        </div>
        <span className="tag tag-gold">{payBull}× Max</span>
      </div>

      {/* Reflex Target Bar & Track */}
      <div style={{
        background: 'var(--bg-elevated)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        padding: '24px 18px',
        marginBottom: 16
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16, textAlign: 'center' }}>
          {running ? 'LOCK IN! Tap SLAM STOP on the center Bullseye!' : 'Target Track'}
        </div>

        {/* Visual Zone Rail */}
        <div style={{
          position: 'relative',
          height: 38,
          background: '#16191c',
          borderRadius: 19,
          border: '1.5px solid var(--border)',
          overflow: 'hidden',
          marginBottom: 16
        }}>
          {/* Blue Outer Zone (22% to 78%) */}
          <div style={{
            position: 'absolute',
            left: '22%',
            width: '56%',
            height: '100%',
            background: 'rgba(52, 152, 219, 0.25)',
            borderLeft: '1px dashed var(--blue)',
            borderRight: '1px dashed var(--blue)'
          }} />

          {/* Emerald Mid Zone (35% to 65%) */}
          <div style={{
            position: 'absolute',
            left: '35%',
            width: '30%',
            height: '100%',
            background: 'rgba(46, 204, 113, 0.35)',
            borderLeft: '1px solid var(--emerald)',
            borderRight: '1px solid var(--emerald)'
          }} />

          {/* Bullseye Gold Zone (46% to 54%) */}
          <div style={{
            position: 'absolute',
            left: '46%',
            width: '8%',
            height: '100%',
            background: 'linear-gradient(90deg, #d4a843, #f1c40f)',
            boxShadow: '0 0 12px rgba(212, 168, 67, 0.6)'
          }} />

          {/* Moving Cursor Indicator */}
          <div style={{
            position: 'absolute',
            left: `${cursorPos}%`,
            top: 0,
            bottom: 0,
            width: 6,
            marginLeft: -3,
            background: '#ffffff',
            borderRadius: 3,
            boxShadow: '0 0 10px #ffffff',
            transition: running ? 'none' : 'left 0.1s ease'
          }} />
        </div>

        {/* Multiplier Badges Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center' }}>
          <div style={{ background: 'var(--bg-card)', padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(52, 152, 219, 0.3)' }}>
            <div style={{ fontSize: 10, color: 'var(--blue)', fontWeight: 700 }}>Outer (22-78%)</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 800 }}>{payOuter}×</div>
          </div>
          <div style={{ background: 'var(--bg-card)', padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(46, 204, 113, 0.3)' }}>
            <div style={{ fontSize: 10, color: 'var(--emerald)', fontWeight: 700 }}>Emerald (35-65%)</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 800 }}>{payMid}×</div>
          </div>
          <div style={{ background: 'var(--bg-card)', padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(212, 168, 67, 0.3)' }}>
            <div style={{ fontSize: 10, color: 'var(--gold)', fontWeight: 700 }}>Bullseye (46-54%)</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 800 }}>{payBull}×</div>
          </div>
        </div>
      </div>

      {/* Outcome Banner */}
      {lastOutcome && (
        <div className="card" style={{
          textAlign: 'center', marginBottom: 14, padding: 12,
          background: lastOutcome.isWin ? 'rgba(46, 204, 113, 0.08)' : 'rgba(231, 76, 60, 0.08)',
          borderColor: lastOutcome.isWin ? 'var(--emerald)' : 'var(--red)'
        }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: lastOutcome.isWin ? 'var(--emerald)' : 'var(--red)' }}>
            {lastOutcome.zoneTitle}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            Stopped at position <b>{lastOutcome.pos.toFixed(1)}%</b> —{' '}
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: lastOutcome.isWin ? 'var(--emerald)' : 'var(--red)' }}>
              {lastOutcome.payout > 0 ? `+${lastOutcome.payout.toLocaleString()} SC` : '0 SC'}
            </span>
          </div>
        </div>
      )}

      {/* Action Button */}
      {running ? (
        <button
          className="btn btn-gold btn-lg"
          style={{ width: '100%', fontSize: 16, fontWeight: 900 }}
          onClick={stopGrind}
        >
          🛑 SLAM STOP NOW!
        </button>
      ) : (
        <button
          className="btn btn-primary btn-lg"
          style={{ width: '100%' }}
          onClick={startGrind}
        >
          Start Precision Grind ({stake} SC)
        </button>
      )}
    </div>
  );
}
