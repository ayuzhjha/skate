import { useState } from 'react';
import { useStore } from '../hooks';
import { api, newIdempotency } from '../api';
import {
  applyServerBalance,
  recordLocalGameResult,
  handleGameError,
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
  const [settling, setSettling] = useState(false);
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

    // No server call here: tile picking is visual only. The stake is
    // settled exactly once by the server — at cashout, or on a bomb hit.
    playSound('chip');

    // Local bomb shuffle (visual layout only — the server settles purely
    // on the revealed-gem count at cashout).
    const indices = Array.from({ length: 25 }, (_, i) => i);
    for (let i = 24; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
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
      // Hit a bomb -> reveal all bombs, round over. The loss settles
      // server-side: the stake is debited with payout 0 (see /mines/bomb).
      newTiles.forEach((tile, i) => {
        if (tile.isBomb) newTiles[i] = { ...tile, isRevealed: true };
      });
      setTiles(newTiles);
      setIsActive(false);
      playSound('loss');
      triggerHaptic([40, 60, 80]);
      recordLocalGameResult('Emerald Mines', gameStake, 0, false);
      showToast('💥 Boom! Hit a Mine — round over, no cashout', 'danger');
      setSettling(true);
      api.minesBomb(gameStake, newIdempotency())
        .then((res) => applyServerBalance(res.balance, res.xp))
        .catch((err) => void handleGameError(err))
        .finally(() => setSettling(false));
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
        // Complete sweep — settle through the server like a cashout.
        setIsActive(false);
        void settleMines(newGems, nextM, `🏆 FULL BOARD CLEAR!`);
      }
    }
  };

  // Settle a mines round through the server: it debits the stake and pays
  // the multiplier for the revealed-gem count. Returns true on success.
  const settleMines = async (gems, localMult, winPrefix) => {
    if (settling) return false;
    setSettling(true);
    try {
      const res = await api.mines(gameStake, bombCount, gems, newIdempotency());
      applyServerBalance(res.balance, res.xp);
      recordLocalGameResult('Emerald Mines', gameStake, res.payout, false);
      triggerWinVibration(res.multiplier);
      showToast(`${winPrefix} Won ${res.payout.toLocaleString()} SC (${res.multiplier}×)!`, 'gold');
      return true;
    } catch (err) {
      await handleGameError(err);
      return false;
    } finally {
      setSettling(false);
    }
  };

  const cashOut = async () => {
    if (!isActive || gemsFound === 0 || settling) return;
    setIsActive(false);

    // Reveal remaining bombs
    const newTiles = tiles.map(t => (t.isBomb ? { ...t, isRevealed: true } : t));
    setTiles(newTiles);

    await settleMines(gemsFound, currentMult, '💎 Cashed Out');
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
          disabled={gemsFound === 0 || settling}
        >
          {settling
            ? 'Settling with server…'
            : gemsFound === 0
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
