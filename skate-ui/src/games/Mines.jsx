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

const BOMB_OPTIONS = [1, 2, 3, 5, 10, 15, 20, 24];

export default function MinesGame({ stake }) {
  const state = useStore();
  const [bombCount, setBombCount] = useState(5);
  const [isActive, setIsActive] = useState(false);
  const [tiles, setTiles] = useState(Array.from({ length: 25 }, () => ({ isBomb: false, isRevealed: false })));
  const [gemsFound, setGemsFound] = useState(0);
  const [currentMult, setCurrentMult] = useState(1.0);
  const [gameStake, setGameStake] = useState(stake);

  const startRound = () => {
    if (isActive) return;
    if (state.credits < stake) {
      showToast('Insufficient virtual credits!', 'danger');
      return;
    }

    setGameStake(stake);
    setIsActive(true);
    setGemsFound(0);
    setCurrentMult(1.0);

    // Record bet
    recordTransaction('bet', `Emerald Mines (${bombCount} Bombs)`, -stake, `Stake: ${stake} SC`);
    playSound('chip');

    // Provably fair bomb shuffle
    const indices = Array.from({ length: 25 }, (_, i) => i);
    for (let i = 24; i > 0; i--) {
      const j = Math.floor(nextProvablyFairFloat() * (i + 1));
      const tmp = indices[i];
      indices[i] = indices[j];
      indices[j] = tmp;
    }
    const bombSet = new Set(indices.slice(0, bombCount));
    const newTiles = Array.from({ length: 25 }, (_, i) => ({
      isBomb: bombSet.has(i),
      isRevealed: false,
    }));
    setTiles(newTiles);
  };

  const clickTile = (idx) => {
    if (!isActive) {
      showToast('Tap Start Mine Sweep to begin!', 'info');
      return;
    }
    const t = tiles[idx];
    if (t.isRevealed) return;

    const newTiles = [...tiles];
    newTiles[idx] = { ...t, isRevealed: true };

    if (t.isBomb) {
      // Hit a bomb -> reveal all bombs
      newTiles.forEach((tile, i) => {
        if (tile.isBomb) newTiles[i] = { ...tile, isRevealed: true };
      });
      setTiles(newTiles);
      setIsActive(false);
      playSound('loss');
      triggerHaptic([40, 60, 80]);
      recordGameOutcome('Emerald Mines', gameStake, 0, `Hit bomb after ${gemsFound} gems`);
      showToast('💥 Boom! Hit a Mine — Wager Lost', 'danger');
    } else {
      // Found a safe gem
      const newGems = gemsFound + 1;
      setGemsFound(newGems);

      const remainingSafe = 25 - bombCount - (newGems - 1);
      const remainingTotal = 25 - (newGems - 1);
      const nextM = +(currentMult * (remainingTotal / remainingSafe) * 0.98).toFixed(2);
      setCurrentMult(nextM);

      setTiles(newTiles);
      playSound('win');
      triggerHaptic(15);

      // Check if all safe gems cleared!
      if (newGems === 25 - bombCount) {
        // Complete sweep!
        setIsActive(false);
        const payout = Math.round(gameStake * nextM);
        recordGameOutcome('Emerald Mines', gameStake, payout, `Swept all ${newGems} gems!`);
        triggerWinVibration(nextM);
        showToast(`🏆 FULL BOARD CLEAR! Won ${payout.toLocaleString()} SC!`, 'gold');
      }
    }
  };

  const cashOut = () => {
    if (!isActive || gemsFound === 0) return;
    setIsActive(false);
    const payout = Math.round(gameStake * currentMult);

    // Reveal remaining bombs
    const newTiles = tiles.map(t => (t.isBomb ? { ...t, isRevealed: true } : t));
    setTiles(newTiles);

    recordGameOutcome('Emerald Mines', gameStake, payout, `Cashed out ${gemsFound} gems @ ${currentMult}×`);
    triggerWinVibration(currentMult);
    showToast(`💎 Cashed Out ${payout.toLocaleString()} SC (${currentMult}×)!`, 'gold');
  };

  const potentialPayout = Math.round(gameStake * currentMult);

  return (
    <div className="game-stage active">
      {/* Bomb Count Selection & Stats Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <img src="/bomb.png" alt="Bombs" style={{ width: 18, height: 18, objectFit: 'contain' }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>Mines:</span>
          <select
            value={bombCount}
            onChange={(e) => setBombCount(Number(e.target.value))}
            disabled={isActive}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              borderRadius: 8,
              padding: '4px 10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              fontSize: 13
            }}
          >
            {BOMB_OPTIONS.map(b => (
              <option key={b} value={b}>{b} {b === 1 ? 'Bomb' : 'Bombs'}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <img src="/diamond.png" alt="Gems" style={{ width: 16, height: 16, objectFit: 'contain' }} />
            <span>Gems: <b style={{ color: 'var(--emerald)' }}>{gemsFound}</b></span>
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 14,
            fontWeight: 800,
            color: 'var(--gold)',
            background: 'var(--gold-subtle)',
            padding: '2px 8px',
            borderRadius: 6
          }}>
            {currentMult.toFixed(2)}×
          </div>
        </div>
      </div>

      {/* 5x5 Mine Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: 8,
        background: 'var(--bg-elevated)',
        padding: 12,
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        marginBottom: 16
      }}>
        {tiles.map((t, idx) => {
          let bg = 'var(--bg-card)';
          let border = '1px solid var(--border)';
          let content = <span style={{ opacity: 0.35, fontSize: 16 }}>❓</span>;

          if (t.isRevealed) {
            if (t.isBomb) {
              bg = 'rgba(231, 76, 60, 0.25)';
              border = '1.5px solid var(--red)';
              content = <img src="/bomb.png" alt="Bomb" style={{ width: 32, height: 32, objectFit: 'contain', animation: 'scaleUp 0.2s ease' }} />;
            } else {
              bg = 'rgba(46, 204, 113, 0.25)';
              border = '1.5px solid var(--emerald)';
              content = <img src="/diamond.png" alt="Diamond" style={{ width: 32, height: 32, objectFit: 'contain', animation: 'scaleUp 0.2s ease' }} />;
            }
          }

          return (
            <button
              key={idx}
              onClick={() => clickTile(idx)}
              disabled={!isActive && !t.isRevealed}
              style={{
                aspectRatio: '1',
                borderRadius: 10,
                background: bg,
                border,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: isActive && !t.isRevealed ? 'pointer' : 'default',
                transform: t.isRevealed ? 'scale(0.96)' : 'none',
                transition: 'transform 0.15s ease, background 0.15s ease',
                boxShadow: t.isRevealed ? 'none' : '0 2px 6px rgba(0,0,0,0.3)'
              }}
            >
              {content}
            </button>
          );
        })}
      </div>

      {/* Control Buttons */}
      {isActive ? (
        <button
          className="btn btn-gold btn-lg"
          style={{ width: '100%' }}
          onClick={cashOut}
          disabled={gemsFound === 0}
        >
          {gemsFound === 0
            ? 'Pick a Tile to Unlock Cashout'
            : `Cash Out ${potentialPayout.toLocaleString()} SC (${currentMult.toFixed(2)}×)`}
        </button>
      ) : (
        <button
          className="btn btn-primary btn-lg"
          style={{ width: '100%' }}
          onClick={startRound}
        >
          Start Mine Sweep ({stake} SC)
        </button>
      )}
    </div>
  );
}
