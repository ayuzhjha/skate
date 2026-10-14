import { useNavigate } from 'react-router-dom';
import { TrendingUp, Gamepad2, Gift, Trophy, Crown, Flame, ChevronRight } from 'lucide-react';
import { useStore } from '../hooks';
import { LEVEL_TITLES, claimDailyReward, isDailyClaimAvailable } from '../store';

const FEATURED_GAMES = [
  { id: 'blackjack', title: 'Blackjack', desc: '6-Deck Vegas Shoe', bg: '/card-blackjack.svg' },
  { id: 'plinko', title: 'Plinko', desc: '8-Row Drop', bg: '/card-plinko.svg' },
  { id: 'mines', title: 'Mines', desc: '5×5 Grid', bg: '/card-mines.svg', highlighted: true },
  { id: 'dice', title: 'Dice', desc: 'Over / Under', bg: '/card-dice.svg' },
];

export default function HomePage() {
  const state = useStore();
  const navigate = useNavigate();

  const rankTitle = LEVEL_TITLES[Math.min(LEVEL_TITLES.length - 1, state.level - 1)];
  const xpNeeded = state.level * 200;
  const xpPct = Math.min(100, Math.round((state.xp / xpNeeded) * 100));
  const winRate = state.stats.totalBets > 0 ? ((state.stats.wins / state.stats.totalBets) * 100).toFixed(1) : '0.0';
  const canClaim = isDailyClaimAvailable();

  return (
    <div className="home-page-container">
      {/* Hero Profile Card */}
      <div className="hero-card">
        {/* Background ambient skate art */}
        <div className="hero-bg-graphic" />

        <div className="hero-header-row">
          <div className="hero-avatar-ring">
            <img src="/avatar-skate.svg" alt="Avatar" className="hero-avatar-img" />
          </div>

          <div className="hero-user-details">
            <div className="hero-name-badge-row">
              <span className="hero-username">{state.auth.username}</span>
              <span className={`pill-badge ${state.auth.isRegistered ? 'pill-gold' : 'pill-emerald'}`}>
                {state.auth.isRegistered ? 'Verified' : 'Guest'}
              </span>
            </div>
            <div className="hero-user-level">
              Level {state.level} · {rankTitle}
            </div>
          </div>
        </div>

        {/* XP Progress Bar */}
        <div className="hero-progress-section">
          <div className="hero-progress-labels">
            <span>LVL {state.level}</span>
            <span>{state.xp} / {xpNeeded} XP</span>
          </div>
          <div className="hero-progress-track">
            <div className="hero-progress-fill" style={{ width: `${Math.max(8, xpPct)}%` }} />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="hero-cta-grid">
          <button className="btn-hero-primary" onClick={() => navigate('/play')}>
            <Gamepad2 size={18} />
            <span>Play Now</span>
            <ChevronRight size={16} />
          </button>
          <button
            className="btn-hero-glass"
            onClick={canClaim ? claimDailyReward : () => navigate('/rewards')}
          >
            <Gift size={18} color="#facc15" />
            <span>{canClaim ? 'Claim Streak' : 'Streak Claimed'}</span>
          </button>
        </div>
      </div>

      {/* Quick Stats Section */}
      <div className="section-header-row">
        <div className="section-title-wrap">
          <TrendingUp size={18} color="#ffffff" />
          <span className="section-title-text">Quick Stats</span>
        </div>
        <button className="pill-link-btn" onClick={() => navigate('/profile')}>
          View Details <ChevronRight size={14} />
        </button>
      </div>

      <div className="stats-2x2-grid">
        {/* Card 1: Win Rate */}
        <div className="stat-quad-card">
          <div className="stat-quad-top">
            <div className="stat-icon-squircle squircle-green">
              <Trophy size={18} color="#ffffff" />
            </div>
            {/* Sparkline icon */}
            <svg width="34" height="20" viewBox="0 0 34 20" fill="none">
              <path d="M 2 16 L 10 13 L 18 15 L 26 5 L 32 3" stroke="#00e676" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="stat-quad-label">Win Rate</div>
          <div className="stat-quad-val val-green">{winRate}%</div>
          <div className="stat-quad-sub">{state.stats.wins}W - {state.stats.losses}L</div>
        </div>

        {/* Card 2: Net Profit */}
        <div className="stat-quad-card">
          <div className="stat-quad-top">
            <div className="stat-icon-squircle squircle-gold">
              <span style={{ fontSize: 13, fontWeight: 900, color: '#ffffff' }}>$</span>
            </div>
            {/* Mini bar chart */}
            <svg width="22" height="18" viewBox="0 0 22 18" fill="none">
              <rect x="2" y="10" width="3" height="8" rx="1" fill="#00e676" />
              <rect x="8" y="6" width="3" height="12" rx="1" fill="#00e676" />
              <rect x="14" y="2" width="3" height="16" rx="1" fill="#00e676" />
            </svg>
          </div>
          <div className="stat-quad-label">Net Profit</div>
          <div className="stat-quad-val val-green">
            {state.stats.netProfit >= 0 ? `+${state.stats.netProfit}` : state.stats.netProfit}
          </div>
          <div className="stat-quad-sub">{state.stats.totalBets} rounds</div>
        </div>

        {/* Card 3: Best Win */}
        <div className="stat-quad-card">
          <div className="stat-quad-top">
            <div className="stat-icon-squircle squircle-amber">
              <Crown size={18} color="#ffffff" />
            </div>
          </div>
          <div className="stat-quad-label">Best Win</div>
          <div className="stat-quad-val val-gold">+{state.stats.biggestWin.toLocaleString()}</div>
          <div className="stat-quad-sub">Best streak: {state.stats.bestWinStreak}</div>
        </div>

        {/* Card 4: Login Streak */}
        <div className="stat-quad-card">
          <div className="stat-quad-top">
            <div className="stat-icon-squircle squircle-red">
              <Flame size={18} color="#ffffff" />
            </div>
          </div>
          <div className="stat-quad-label">Login Streak</div>
          <div className="stat-quad-val val-white">Day {state.streak.currentDay}</div>
          <div className="stat-quad-sub">{state.streak.totalClaims} total claims</div>
        </div>
      </div>

      {/* Games Section */}
      <div className="section-header-row" style={{ marginTop: 22 }}>
        <div className="section-title-wrap">
          <Gamepad2 size={18} color="#ffffff" />
          <span className="section-title-text">Games</span>
        </div>
        <button className="pill-link-btn" onClick={() => navigate('/play')}>
          View All <ChevronRight size={14} />
        </button>
      </div>

      <div className="games-2x2-grid">
        {FEATURED_GAMES.map(g => (
          <div
            key={g.id}
            className={`game-artwork-card ${g.highlighted ? 'game-card-highlight' : ''}`}
            onClick={() => navigate(`/play/${g.id}`)}
            style={{ backgroundImage: `url(${g.bg})` }}
          >
            <div className="game-card-info-row">
              <div className="game-card-texts">
                <div className="game-card-title-text">{g.title}</div>
                <div className="game-card-desc-text">{g.desc}</div>
              </div>
              <div className="game-card-chevron-btn">
                <ChevronRight size={16} color="#ffffff" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
