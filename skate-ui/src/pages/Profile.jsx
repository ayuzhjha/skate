import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Crown,
  ShieldCheck,
  Calendar,
  Trophy,
  BarChart3,
  ChevronRight,
  Lock,
  Medal,
  Flame,
  Diamond,
  User,
  Pencil
} from 'lucide-react';
import { useStore } from '../hooks';
import { LEVEL_TITLES, AVATARS, getState, saveState, showToast, playSound } from '../store';

export default function ProfilePage() {
  const state = useStore();
  const navigate = useNavigate();
  const [editingAvatar, setEditingAvatar] = useState(false);

  const rankTitle = LEVEL_TITLES[Math.min(LEVEL_TITLES.length - 1, state.level - 1)];
  const xpNeeded = state.level * 200;
  const xpPct = Math.min(100, Math.round((state.xp / xpNeeded) * 100));
  const winRate = state.stats.totalBets > 0 ? ((state.stats.wins / state.stats.totalBets) * 100).toFixed(1) : '0.0';

  const selectAvatar = (av) => {
    const s = getState();
    s.auth.avatar = av;
    saveState();
    playSound('chip');
    setEditingAvatar(false);
    showToast(`Avatar updated to ${av}`, 'emerald');
  };

  return (
    <div className="profile-page-container">
      {/* Profile Hero Card */}
      <div className="profile-hero-card">
        {/* Background ambient skate graphic */}
        <div className="hero-bg-graphic" />

        <div className="profile-header-row">
          <div className="profile-avatar-wrapper" onClick={() => setEditingAvatar(!editingAvatar)}>
            <div className="hero-avatar-ring">
              <img src="/avatar-skate.svg" alt="Avatar" className="hero-avatar-img" />
            </div>
            <div className="profile-pencil-badge">
              <Pencil size={10} color="#cbd5e1" />
            </div>
          </div>

          <div className="profile-user-details">
            <div className="profile-name-badge-row">
              <span className="profile-username">{state.auth.username}</span>
              <span className="vip-crown-badge">
                <Crown size={12} color="#facc15" />
                <span>Verified VIP</span>
              </span>
            </div>

            <div className="profile-level-subtitle">
              Level {state.level} · {rankTitle}
            </div>

            <div className="profile-bankroll-subtitle">
              <span>Virtual Bankroll: </span>
              <b className="val-green">{state.credits.toLocaleString()} SC</b>
            </div>
          </div>
        </div>

        {/* Avatar Tray if editing */}
        {editingAvatar && (
          <div className="avatar-picker-tray">
            <div className="avatar-picker-label">SELECT AVATAR</div>
            <div className="avatar-picker-grid">
              {AVATARS.map(av => (
                <button
                  key={av}
                  className="avatar-picker-opt"
                  onClick={() => selectAvatar(av)}
                >
                  {av}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Progress Bar */}
        <div className="hero-progress-section" style={{ marginTop: 16 }}>
          <div className="hero-progress-labels">
            <span>LVL {state.level}</span>
            <span>{state.xp} / {xpNeeded} XP</span>
          </div>
          <div className="hero-progress-track">
            <div className="hero-progress-fill" style={{ width: `${Math.max(8, xpPct)}%` }} />
          </div>
        </div>
      </div>

      {/* Two Info Cards Row */}
      <div className="info-cards-duo-row">
        <div className="info-duo-card" onClick={() => navigate('/settings')}>
          <div className="stat-icon-squircle squircle-green">
            <ShieldCheck size={18} color="#00e676" />
          </div>
          <div className="info-duo-texts">
            <div className="info-duo-title">VIP Account Verified</div>
            <div className="info-duo-sub">
              Linked Email: {state.auth.email || 'asd@sdf.gh'}
            </div>
          </div>
          <ChevronRight size={16} color="#64748b" />
        </div>

        <div className="info-duo-card" onClick={() => navigate('/settings')}>
          <div className="stat-icon-squircle squircle-green">
            <Calendar size={18} color="#00e676" />
          </div>
          <div className="info-duo-texts">
            <div className="info-duo-title">Member Since</div>
            <div className="info-duo-sub">Oct 2026</div>
          </div>
          <ChevronRight size={16} color="#64748b" />
        </div>
      </div>

      {/* Career Performance Section */}
      <div className="section-header-row" style={{ marginTop: 22 }}>
        <div className="section-title-wrap">
          <Trophy size={18} color="#ffffff" />
          <span className="section-title-text">Career Performance</span>
        </div>
        <button className="pill-link-btn" onClick={() => navigate('/history')}>
          View Detailed Stats <ChevronRight size={14} />
        </button>
      </div>

      <div className="stats-2x2-grid">
        {/* Win Rate */}
        <div className="stat-quad-card">
          <div className="stat-quad-top">
            <div className="stat-icon-squircle squircle-green">
              <BarChart3 size={18} color="#00e676" />
            </div>
            <svg width="34" height="20" viewBox="0 0 34 20" fill="none">
              <path d="M 2 16 L 10 13 L 18 15 L 26 5 L 32 3" stroke="#00e676" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="stat-quad-label">Win Rate</div>
          <div className="stat-quad-val val-green">{winRate}%</div>
          <div className="stat-quad-sub">{state.stats.wins}W - {state.stats.losses}L - {state.stats.pushes}P</div>
        </div>

        {/* Net Profit */}
        <div className="stat-quad-card">
          <div className="stat-quad-top">
            <div className="stat-icon-squircle squircle-gold">
              <span style={{ fontSize: 13, fontWeight: 900, color: '#ffffff' }}>$</span>
            </div>
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
          <div className="stat-quad-sub">{state.stats.totalBets} total rounds</div>
        </div>

        {/* Total Wagered */}
        <div className="stat-quad-card">
          <div className="stat-quad-top">
            <div className="stat-icon-squircle squircle-purple">
              <span style={{ fontSize: 14 }}>🪙</span>
            </div>
          </div>
          <div className="stat-quad-label">Total Wagered</div>
          <div className="stat-quad-val val-white">{state.stats.totalWagered.toLocaleString()}</div>
          <div className="stat-quad-sub">Across 6 game modes</div>
        </div>

        {/* Biggest Win */}
        <div className="stat-quad-card">
          <div className="stat-quad-top">
            <div className="stat-icon-squircle squircle-amber">
              <Crown size={18} color="#ffffff" />
            </div>
          </div>
          <div className="stat-quad-label">Biggest Win</div>
          <div className="stat-quad-val val-gold">+{state.stats.biggestWin.toLocaleString()}</div>
          <div className="stat-quad-sub">Best streak: {state.stats.bestWinStreak}</div>
        </div>
      </div>

      {/* Trophy Showcase Section */}
      <div className="section-header-row" style={{ marginTop: 24, marginBottom: 14 }}>
        <div className="section-title-wrap">
          <Trophy size={18} color="#ffffff" />
          <span className="section-title-text">Trophy Showcase</span>
        </div>
        <span className="trophy-unlocked-pill">1 / 6 Unlocked &gt;</span>
      </div>

      <div className="trophy-row-grid">
        {/* Trophy 1: First Blood (Unlocked) */}
        <div className="trophy-card trophy-card-unlocked">
          <div className="trophy-icon-wrap trophy-icon-unlocked">
            <Medal size={22} color="#facc15" />
          </div>
          <div className="trophy-title">First Blood</div>
          <div className="trophy-desc">Win your very first game round</div>
        </div>

        {/* Trophy 2: Natural 21 */}
        <div className="trophy-card trophy-card-locked">
          <div className="trophy-lock-badge">
            <Lock size={12} color="#64748b" />
          </div>
          <div className="trophy-icon-wrap trophy-icon-locked">
            <span style={{ fontSize: 18 }}>🃏</span>
          </div>
          <div className="trophy-title">Natural 21</div>
          <div className="trophy-desc">Hit a natural 3:2 Blackjack</div>
        </div>

        {/* Trophy 3: Heater Streak */}
        <div className="trophy-card trophy-card-locked">
          <div className="trophy-lock-badge">
            <Lock size={12} color="#64748b" />
          </div>
          <div className="trophy-icon-wrap trophy-icon-locked">
            <Flame size={20} color="#f97316" />
          </div>
          <div className="trophy-title">Heater Streak</div>
          <div className="trophy-desc">Win 3 rounds in a row</div>
        </div>

        {/* Trophy 4: High Roller */}
        <div className="trophy-card trophy-card-locked">
          <div className="trophy-lock-badge">
            <Lock size={12} color="#64748b" />
          </div>
          <div className="trophy-icon-wrap trophy-icon-locked">
            <Diamond size={20} color="#38bdf8" />
          </div>
          <div className="trophy-title">High Roller</div>
          <div className="trophy-desc">Place a wager of 1,000 SC</div>
        </div>
      </div>

      {/* Account Settings List */}
      <div className="account-actions-card" style={{ marginTop: 22 }}>
        <div className="account-action-item" onClick={() => navigate('/settings')}>
          <div className="account-action-icon-circle">
            <User size={18} color="#cbd5e1" />
          </div>
          <div className="account-action-body">
            <div className="account-action-title">Account Settings</div>
            <div className="account-action-sub">Profile, email, password</div>
          </div>
          <ChevronRight size={16} color="#64748b" />
        </div>

        <div className="account-action-item" onClick={() => navigate('/settings')}>
          <div className="account-action-icon-circle">
            <ShieldCheck size={18} color="#cbd5e1" />
          </div>
          <div className="account-action-body">
            <div className="account-action-title">Verification</div>
            <div className="account-action-sub">KYC, VIP status, linked accounts</div>
          </div>
          <ChevronRight size={16} color="#64748b" />
        </div>

        <div className="account-action-item" onClick={() => navigate('/history')}>
          <div className="account-action-icon-circle">
            <BarChart3 size={18} color="#cbd5e1" />
          </div>
          <div className="account-action-body">
            <div className="account-action-title">Game History</div>
            <div className="account-action-sub">Past rounds, bets, results</div>
          </div>
          <ChevronRight size={16} color="#64748b" />
        </div>
      </div>
    </div>
  );
}
