import { Calendar, Zap, Gamepad2, Crosshair, BarChart3, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../hooks';
import {
  STREAK_REWARDS,
  isDailyClaimAvailable,
  claimDailyReward,
  claimMission
} from '../store';

const MISSION_ICONS = {
  m_play5: { icon: Gamepad2, squircle: 'squircle-green' },
  m_win3: { icon: Crosshair, squircle: 'squircle-blue' },
  m_double1: { icon: BarChart3, squircle: 'squircle-purple' },
  m_wager1000: { icon: Zap, squircle: 'squircle-gold' },
};

export default function RewardsPage() {
  const state = useStore();
  const canClaimStreak = isDailyClaimAvailable();
  const currentStreakDay = state.streak.currentDay;
  const [claiming, setClaiming] = useState(false);

  const onClaimStreak = async () => {
    if (claiming) return;
    setClaiming(true);
    try {
      await claimDailyReward();
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="rewards-page-container">
      {/* 7-Day Login Streak Card */}
      <div className="streak-main-card">
        <div className="streak-card-header">
          <div className="streak-title-wrap">
            <Calendar size={18} color="#00e676" />
            <span className="streak-title-text">7-Day Login Streak</span>
          </div>
          <span className="streak-claims-pill">Total Claims: {state.streak.totalClaims}</span>
        </div>

        <div className="streak-card-desc">
          Claim daily login rewards to build your virtual bankroll. Keep your streak alive for the{' '}
          <b style={{ color: '#facc15' }}>3,000 SC</b> Day 7 bonus!
        </div>

        {/* 7 Streak Days Row */}
        <div className="streak-days-row">
          {STREAK_REWARDS.map((amt, idx) => {
            const dayNum = idx + 1;
            const isToday = dayNum === currentStreakDay;
            const isPast = dayNum < currentStreakDay;

            return (
              <div
                key={dayNum}
                className={`streak-day-item ${isToday ? 'streak-day-active' : ''} ${isPast ? 'streak-day-done' : ''}`}
              >
                <div className="streak-day-label">Day {dayNum}</div>
                <div className="streak-day-icon">
                  {dayNum === 7 ? '👑' : '🎁'}
                </div>
                <div className="streak-day-amount">
                  +{amt >= 1000 ? `${(amt / 1000).toFixed(1)}k` : amt}
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="streak-actions-grid">
          <button
            className="btn-claim-streak-gold"
            onClick={onClaimStreak}
            disabled={!canClaimStreak || claiming}
          >
            <span style={{ fontSize: 16 }}>🎁</span>
            <span>
              {claiming
                ? 'Claiming…'
                : canClaimStreak
                ? `Claim Day ${currentStreakDay} (server decides the bonus)`
                : 'Claimed Today'}
            </span>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Daily Missions Section */}
      <div className="section-header-row" style={{ marginTop: 24, marginBottom: 14 }}>
        <div className="section-title-wrap">
          <Zap size={18} color="#00e676" />
          <span className="section-title-text">Daily Missions</span>
        </div>
      </div>

      <div className="missions-list">
        {state.missions.slice(0, 3).map(m => {
          const isComplete = m.progress >= m.target;
          const pct = Math.min(100, Math.round((m.progress / m.target) * 100));
          const config = MISSION_ICONS[m.id] || { icon: Zap, squircle: 'squircle-green' };
          const IconComp = config.icon;

          return (
            <div key={m.id} className="mission-card">
              <div className="mission-top-row">
                <div className={`stat-icon-squircle ${config.squircle}`} style={{ flexShrink: 0 }}>
                  <IconComp size={18} color="#ffffff" />
                </div>
                <div className="mission-texts">
                  <div className="mission-title">{m.title}</div>
                  <div className="mission-desc">{m.desc}</div>
                </div>
                <div className="mission-reward-pill">
                  <span className="mini-gold-coin">$</span>
                  <span>+{m.reward} SC</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mission-progress-wrap">
                <div className="mission-progress-labels">
                  <span>Progress</span>
                  <span>{m.progress} / {m.target}</span>
                </div>
                <div className="mission-progress-track">
                  <div
                    className="mission-progress-fill"
                    style={{ width: `${Math.max(2, pct)}%` }}
                  />
                </div>
              </div>

              {/* In Progress / Claim Button */}
              {m.claimed ? (
                <button className="mission-action-btn mission-btn-claimed" disabled>
                  Claimed
                </button>
              ) : isComplete ? (
                <button
                  className="mission-action-btn mission-btn-ready"
                  onClick={() => claimMission(m.id)}
                >
                  Claim +{m.reward} SC
                </button>
              ) : (
                <button className="mission-action-btn mission-btn-progress" disabled>
                  In Progress
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
