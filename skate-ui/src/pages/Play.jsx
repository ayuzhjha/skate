import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Copy, Check } from 'lucide-react';
import { useStore } from '../hooks';
import { MIN_STAKE, playSound, simpleSha256Hex, showToast } from '../store';

import BlackjackGame from '../games/Blackjack';
import PlinkoGame from '../games/Plinko';
import MinesGame from '../games/Mines';
import DiceGame from '../games/Dice';
import CrashGame from '../games/Crash';
import ReflexGame from '../games/Reflex';

const GAME_TABS = [
  { id: 'blackjack', label: 'Blackjack', icon: '🃏' },
  { id: 'plinko', label: 'Plinko', sphereColor: '#38bdf8' },
  { id: 'mines', label: 'Mines', diamond: true },
  { id: 'dice', label: 'Dice', diceColor: '#c084fc' },
  { id: 'crash', label: 'Crash', rocket: true },
];

const CHIP_VALUES = [10, 25, 100, 250, 500];

export default function PlayPage() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const state = useStore();

  const activeGame = gameId && GAME_TABS.some(g => g.id === gameId) ? gameId : 'blackjack';
  const [stake, setStake] = useState(100);
  const [copied, setCopied] = useState(false);

  const switchGame = (id) => {
    playSound('chip');
    navigate(`/play/${id}`);
  };

  const adjustStake = (delta) => {
    playSound('chip');
    setStake(prev => Math.max(1, prev + delta));
  };

  const multiplyStake = (factor) => {
    playSound('chip');
    setStake(prev => Math.max(1, Math.round(prev * factor)));
  };

  const setMaxStake = () => {
    playSound('chip');
    // Set to all credits, or whatever balance user has
    setStake(Math.max(1, state.credits));
  };

  const handleCustomStakeChange = (e) => {
    const val = parseInt(e.target.value, 10);
    if (isNaN(val)) {
      setStake(0);
    } else {
      setStake(Math.max(0, val));
    }
  };

  // Dynamic slider range that scales with user balance and custom entered stake
  const dynamicMax = Math.max(1000, state.credits, stake);

  const currentSeedHash = simpleSha256Hex(`${state.fairness.serverSeed}:${state.fairness.clientSeed}:${state.fairness.nonce}`).slice(0, 10);

  const copyHash = () => {
    navigator.clipboard?.writeText(currentSeedHash);
    setCopied(true);
    showToast('Provably Fair Hash copied!', 'emerald');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="play-page-container">
      {/* Game Selector Pills */}
      <div className="game-pills-scroll-row">
        {GAME_TABS.map(tab => {
          const isActive = activeGame === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => switchGame(tab.id)}
              className={`game-pill-btn ${isActive ? 'game-pill-active' : ''}`}
            >
              {tab.icon && <span style={{ fontSize: 16 }}>{tab.icon}</span>}
              {tab.sphereColor && (
                <span className="pill-sphere-icon" style={{ background: tab.sphereColor }} />
              )}
              {tab.diamond && <span style={{ fontSize: 15, color: '#38bdf8' }}>💎</span>}
              {tab.diceColor && <span style={{ fontSize: 15 }}>🎲</span>}
              {tab.rocket && <span style={{ fontSize: 15 }}>🚀</span>}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Wager Stake Card */}
      <div className="wager-stake-card">
        <div className="wager-stake-header">
          <span className="wager-stake-title">WAGER STAKE</span>
          <div className="wager-fairness-wrap">
            <span className="wager-nonce-label">Nonce #{state.fairness.nonce}</span>
            <div className="wager-hash-pill" onClick={copyHash} title="Click to copy hash">
              <span>{currentSeedHash}...</span>
              {copied ? <Check size={12} color="#00e676" /> : <Copy size={12} color="#00e676" />}
            </div>
          </div>
        </div>

        {/* Stake Slider & Custom Entry Box */}
        <div className="wager-slider-row">
          <input
            type="range"
            min={1}
            max={dynamicMax}
            step="10"
            value={Math.min(stake, dynamicMax)}
            onChange={(e) => setStake(Math.max(1, Number(e.target.value)))}
            className="wager-range-slider"
          />
          <div className="wager-amount-box" title="Tap to enter custom stake amount">
            <input
              type="number"
              min="1"
              value={stake === 0 ? '' : stake}
              onChange={handleCustomStakeChange}
              placeholder="0"
              className="wager-custom-input"
            />
            <span className="wager-amount-unit">SC</span>
          </div>
        </div>

        {/* Quick Chip Presets & MAX */}
        <div className="wager-chips-row">
          {CHIP_VALUES.map(val => (
            <button
              key={val}
              onClick={() => adjustStake(val)}
              className="chip-preset-btn"
            >
              +{val}
            </button>
          ))}
          <button
            onClick={() => multiplyStake(0.5)}
            className="chip-preset-btn"
          >
            ½
          </button>
          <button
            onClick={() => multiplyStake(2)}
            className="chip-preset-btn"
          >
            2x
          </button>
          <button
            onClick={setMaxStake}
            className="chip-preset-btn chip-btn-max"
            title="Wager all available balance"
          >
            MAX
          </button>
        </div>
      </div>

      {/* Active Game Component Mount */}
      {activeGame === 'blackjack' && <BlackjackGame stake={stake} />}
      {activeGame === 'plinko' && <PlinkoGame stake={stake} />}
      {activeGame === 'mines' && <MinesGame stake={stake} />}
      {activeGame === 'dice' && <DiceGame stake={stake} />}
      {activeGame === 'crash' && <CrashGame stake={stake} />}
      {activeGame === 'reflex' && <ReflexGame stake={stake} />}
    </div>
  );
}
