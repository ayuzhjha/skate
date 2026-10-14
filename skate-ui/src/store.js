/* State management — single source of truth persisted to localStorage */

const STORAGE_KEY = 'SKATE_APP_STATE_V3';

export const AVATARS = ['🛹', '🃏', '👑', '⚡', '🦊', '💎', '🔥', '🕶️'];
export const STREAK_REWARDS = [250, 400, 600, 850, 1200, 1800, 3000];
export const LEVEL_TITLES = [
  'Street Rookie', 'Deck Hustler', 'Felt Contender', 'Card Counter',
  'High Roller', 'Emerald VIP', 'Royal Shark', 'Skate Legend'
];

export const MIN_STAKE = 10;
export const MAX_STAKE = 5000;

export const PLINKO_MULTIPLIERS = {
  low: [3.5, 2.0, 1.4, 1.1, 0.7, 1.1, 1.4, 2.0, 3.5],
  high: [15.0, 4.5, 1.8, 0.6, 0.3, 0.6, 1.8, 4.5, 15.0],
};

function createDefaultState() {
  return {
    auth: {
      isRegistered: false,
      username: 'Skater_Guest',
      email: '',
      passwordHash: '',
      avatar: '🛹',
      sessionId: 'sess_' + Math.random().toString(36).substring(2, 10),
      lastCloudSync: null,
    },
    credits: 2500,
    xp: 40,
    level: 1,
    streak: { currentDay: 1, lastClaimDate: null, totalClaims: 0 },
    settings: { sound: true, haptics: true, notifications: true, outcomePopups: true },
    stats: {
      totalBets: 0, wins: 0, losses: 0, pushes: 0, blackjacks: 0,
      totalWagered: 0, netProfit: 0, biggestWin: 0,
      currentWinStreak: 0, bestWinStreak: 0, bankrollHistory: [2500],
    },
    missions: [
      { id: 'm_play5', title: 'Arcade Explorer', desc: 'Play 5 rounds across any games', progress: 0, target: 5, reward: 300, claimed: false },
      { id: 'm_win3', title: 'Sharp Edge', desc: 'Win 3 rounds in any game', progress: 0, target: 3, reward: 450, claimed: false },
      { id: 'm_double1', title: 'High Multiplier', desc: 'Hit a 2×+ win or Double Down', progress: 0, target: 1, reward: 350, claimed: false },
      { id: 'm_wager1000', title: 'High Stakes', desc: 'Wager 1,000 SC total', progress: 0, target: 1000, reward: 600, claimed: false },
    ],
    achievements: [
      { id: 'a_first_win', icon: '🥇', title: 'First Blood', desc: 'Win your very first game round', unlocked: false },
      { id: 'a_natural_bj', icon: '🃏', title: 'Natural 21', desc: 'Hit a natural 3:2 Blackjack', unlocked: false },
      { id: 'a_streak3', icon: '🔥', title: 'Heater Streak', desc: 'Win 3 rounds in a row', unlocked: false },
      { id: 'a_bank_5k', icon: '💎', title: '5K Club', desc: 'Reach 5,000 SC balance', unlocked: false },
      { id: 'a_split_master', icon: '⚡', title: 'Reflex Pro', desc: 'Win in Crash, Reflex, or Split', unlocked: false },
      { id: 'a_registered', icon: '🛡️', title: 'Verified VIP', desc: 'Register your account', unlocked: false },
    ],
    ledger: [],
    fairness: {
      serverSeed: 'srv_' + Math.random().toString(36).substring(2, 15) + '_skate2026',
      clientSeed: 'skater_lucky_deck_01',
      nonce: 1,
    },
  };
}

let _state = null;
let _listeners = new Set();

export function getState() {
  if (!_state) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        _state = { ...createDefaultState(), ...parsed };
        // Merge nested objects
        _state.auth = { ...createDefaultState().auth, ...parsed.auth };
        _state.stats = { ...createDefaultState().stats, ...parsed.stats };
        _state.settings = { ...createDefaultState().settings, ...parsed.settings };
        _state.streak = { ...createDefaultState().streak, ...parsed.streak };
        _state.fairness = { ...createDefaultState().fairness, ...parsed.fairness };
        // Ensure arrays exist
        if (!Array.isArray(_state.missions)) _state.missions = createDefaultState().missions;
        if (!Array.isArray(_state.achievements)) _state.achievements = createDefaultState().achievements;
        if (!Array.isArray(_state.ledger)) _state.ledger = [];
      } else {
        _state = createDefaultState();
      }
    } catch {
      _state = createDefaultState();
    }
  }
  return _state;
}

export function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_state));
  } catch {}
  _listeners.forEach(fn => fn(_state));
}

export function subscribe(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

export function resetState() {
  _state = createDefaultState();
  saveState();
}

/* --- Hashing --- */
export function simpleSha256Hex(str) {
  let h1 = 0xdeadbeef ^ str.length, h2 = 0x41c6ce57 ^ str.length;
  let h3 = 0x9e3779b9 ^ str.length, h4 = 0x85ebca6b ^ str.length;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h3 = Math.imul(h3 ^ ch, 2246822507);
    h4 = Math.imul(h4 ^ ch, 3266489909);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  h3 = Math.imul(h3 ^ (h3 >>> 16), 2246822507) ^ Math.imul(h4 ^ (h4 >>> 13), 3266489909);
  h4 = Math.imul(h4 ^ (h4 >>> 16), 2246822507) ^ Math.imul(h3 ^ (h3 >>> 13), 3266489909);
  const hex = (n) => (n >>> 0).toString(16).padStart(8, '0');
  return (hex(h1) + hex(h2) + hex(h3) + hex(h4) + hex(h1 ^ h3) + hex(h2 ^ h4) + hex(h1 + h2) + hex(h3 + h4)).slice(0, 64);
}

export function nextProvablyFairFloat() {
  const s = getState();
  s.fairness.nonce += 1;
  const hash = simpleSha256Hex(`${s.fairness.serverSeed}:${s.fairness.clientSeed}:${s.fairness.nonce}`);
  const intVal = parseInt(hash.slice(0, 8), 16);
  return (intVal >>> 0) / 4294967296;
}

/* --- Transactions --- */
export function recordTransaction(type, label, delta, meta = '') {
  const s = getState();
  const before = s.credits;
  const after = Math.max(0, Math.round(before + delta));
  s.credits = after;
  const txId = 'tx_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
  const tx = {
    id: txId,
    ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    date: new Date().toLocaleDateString(),
    type, label, delta, balanceAfter: after, meta,
    hash: simpleSha256Hex(`${txId}:${before}:${delta}:${after}`).slice(0, 12),
  };
  s.ledger.unshift(tx);
  if (s.ledger.length > 60) s.ledger.pop();
  saveState();
  return tx;
}

/* --- XP & Progression --- */
export function addXp(amount) {
  const s = getState();
  s.xp += amount;
  let needed = s.level * 200;
  while (s.xp >= needed) {
    s.xp -= needed;
    s.level += 1;
    needed = s.level * 200;
    const bonus = s.level * 150;
    recordTransaction('reward', `Level ${s.level} Rank-Up`, bonus, `Promoted to Level ${s.level}`);
    showToast(`🎉 Level Up! Reached Level ${s.level} (+${bonus} SC)`, 'gold');
  }
  saveState();
}

/* --- Missions --- */
export function updateMissionProgress(id, amount) {
  const s = getState();
  const m = s.missions.find(x => x.id === id);
  if (!m || m.claimed) return;
  m.progress = Math.min(m.target, m.progress + amount);
  saveState();
}

export function claimMission(id) {
  const s = getState();
  const m = s.missions.find(x => x.id === id);
  if (!m || m.claimed || m.progress < m.target) return;
  m.claimed = true;
  recordTransaction('reward', `Mission: ${m.title}`, m.reward, m.desc);
  addXp(60);
  showToast(`🎯 Claimed +${m.reward} SC & +60 XP!`, 'emerald');
}

/* --- Achievements --- */
export function checkAchievements() {
  const s = getState();
  const unlock = (id) => {
    const ach = s.achievements.find(a => a.id === id);
    if (ach && !ach.unlocked) {
      ach.unlocked = true;
      recordTransaction('reward', `Achievement: ${ach.title}`, 200, ach.desc);
      showToast(`🏆 ${ach.title} Unlocked! (+200 SC)`, 'gold');
    }
  };
  if (s.stats.wins >= 1) unlock('a_first_win');
  if (s.stats.blackjacks >= 1) unlock('a_natural_bj');
  if (s.stats.bestWinStreak >= 3) unlock('a_streak3');
  if (s.credits >= 5000) unlock('a_bank_5k');
  if (s.auth.isRegistered) unlock('a_registered');
  saveState();
}

/* --- Game Outcome Recording --- */
export function recordGameOutcome(gameName, stake, totalReturn, metaDesc, isSpecial = false) {
  const s = getState();
  const netDelta = Math.round(totalReturn - stake);
  s.stats.totalBets += 1;
  s.stats.totalWagered += stake;
  s.stats.netProfit += netDelta;
  updateMissionProgress('m_play5', 1);
  updateMissionProgress('m_wager1000', stake);

  if (totalReturn > 0) {
    recordTransaction('bet', `${gameName} Payout`, Math.round(totalReturn), metaDesc);
  }

  if (netDelta > 0) {
    s.stats.wins += 1;
    s.stats.currentWinStreak += 1;
    if (s.stats.currentWinStreak > s.stats.bestWinStreak) s.stats.bestWinStreak = s.stats.currentWinStreak;
    if (netDelta > s.stats.biggestWin) s.stats.biggestWin = netDelta;
    updateMissionProgress('m_win3', 1);
    if (totalReturn >= stake * 2) updateMissionProgress('m_double1', 1);
    if (isSpecial) {
      const ach = s.achievements.find(a => a.id === 'a_split_master');
      if (ach && !ach.unlocked) {
        ach.unlocked = true;
        recordTransaction('reward', 'Achievement: Reflex Pro', 200, ach.desc);
      }
    }
    addXp(35);
    playSound('win');
    triggerWinVibration(totalReturn / (stake || 1));
    if (s.settings.outcomePopups !== false) {
      setTimeout(() => {
        showOutcomeModal({
          type: 'win',
          payout: Math.round(totalReturn),
          stake,
          net: netDelta,
          gameName,
          subtitle: totalReturn >= stake * 2.5
            ? `Massive ${(totalReturn / (stake || 1)).toFixed(1)}× win! Keep it up.`
            : 'Great play! Keep it up.'
        });
      }, 280);
    }
  } else if (netDelta < 0) {
    s.stats.losses += 1;
    s.stats.currentWinStreak = 0;
    addXp(15);
    playSound('loss');
    triggerHaptic(25);
    if (s.settings.outcomePopups !== false) {
      setTimeout(() => {
        showOutcomeModal({
          type: 'lose',
          stake,
          gameName,
          headline: 'Better luck next time!',
          subtitle: 'Keep playing to improve your streak.'
        });
      }, 280);
    }
  } else {
    s.stats.pushes += 1;
    addXp(20);
    playSound('chip');
  }

  s.stats.bankrollHistory.push(s.credits);
  if (s.stats.bankrollHistory.length > 25) s.stats.bankrollHistory.shift();
  checkAchievements();
  saveState();
}

/* --- Streak & Rewards --- */
export function isDailyClaimAvailable() {
  const s = getState();
  const todayStr = new Date().toISOString().slice(0, 10);
  return s.streak.lastClaimDate !== todayStr;
}

export function claimDailyReward() {
  const s = getState();
  const todayStr = new Date().toISOString().slice(0, 10);
  if (s.streak.lastClaimDate === todayStr) {
    showToast("Today's bonus already claimed!", 'blue');
    return;
  }
  const idx = (s.streak.currentDay - 1) % 7;
  const rewardAmt = STREAK_REWARDS[idx];
  s.streak.lastClaimDate = todayStr;
  s.streak.totalClaims += 1;
  recordTransaction('reward', `Day ${s.streak.currentDay} Streak`, rewardAmt, 'Daily Login Reward');
  addXp(50);
  s.streak.currentDay = (s.streak.currentDay % 7) + 1;
  playSound('blackjack');
  triggerHaptic([25, 50, 25]);
  showToast(`🎁 Day Streak Claimed! +${rewardAmt.toLocaleString()} SC`, 'gold');
  saveState();
}

export function simulateNextDay() {
  const s = getState();
  s.streak.lastClaimDate = '2000-01-01';
  saveState();
  showToast('⏩ Simulated next day!', 'blue');
}

export function claimFaucet() {
  recordTransaction('reward', 'Complimentary Faucet', 150, 'Free Top-Up');
  playSound('chip');
  showToast('💧 +150 SC Faucet claimed!', 'emerald');
}

export function claimBailout() {
  const s = getState();
  if (s.credits >= 200) {
    showToast('Bailout is for balances under 200 SC!', 'blue');
    return;
  }
  recordTransaction('reward', 'Zero-Balance Bailout', 500, 'Free Bailout');
  playSound('win');
  showToast('⚡ +500 SC Bailout added!', 'gold');
}

/* --- Audio & Haptics --- */
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

export function playSound(type) {
  const s = getState();
  if (!s.settings.sound) return;
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (type === 'chip') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1480, now);
      osc.frequency.exponentialRampToValueAtTime(2200, now + 0.06);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now); osc.stop(now + 0.07);
    } else if (type === 'card') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.08);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now); osc.stop(now + 0.09);
    } else if (type === 'win' || type === 'blackjack') {
      const notes = type === 'blackjack' ? [523.25, 659.25, 783.99, 1046.5] : [440, 554.37, 659.25];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.075);
        gain.gain.setValueAtTime(0.18, now + idx * 0.075);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.075 + 0.28);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(now + idx * 0.075); osc.stop(now + idx * 0.075 + 0.29);
      });
    } else if (type === 'loss') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(190, now);
      osc.frequency.linearRampToValueAtTime(115, now + 0.22);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now); osc.stop(now + 0.25);
    }
  } catch {}
}

export function triggerHaptic(pattern = 25) {
  const s = getState();
  if (!s.settings.haptics) return;

  // 1. Android Native WebView Bridge (100% reliable hardware vibration on device)
  try {
    if (window.AndroidHaptics) {
      if (Array.isArray(pattern)) {
        window.AndroidHaptics.vibratePattern(pattern.join(','));
      } else {
        window.AndroidHaptics.vibrateOneShot(Number(pattern) || 25);
      }
    }
  } catch {}

  // 2. Web Standard Navigator Vibrate
  try {
    if (navigator && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {}
}

let _lastWinVibe = 0;

export function triggerVisualWinShake() {
  try {
    const targets = [
      document.querySelector('.game-stage'),
      document.querySelector('.app-shell')
    ].filter(Boolean);

    targets.forEach(el => {
      el.classList.remove('win-vibrate-effect', 'win-glow-pulse');
      void el.offsetWidth; // Force CSS reflow
      el.classList.add('win-vibrate-effect', 'win-glow-pulse');
      setTimeout(() => {
        el.classList.remove('win-vibrate-effect', 'win-glow-pulse');
      }, 500);
    });
  } catch {}
}

export function triggerWinVibration(multiplier = 1) {
  const s = getState();
  if (!s.settings.haptics) return;

  const now = Date.now();
  if (now - _lastWinVibe < 180) return;
  _lastWinVibe = now;

  // Dynamic Victory Vibration:
  // For huge wins (>= 2x multiplier): dynamic triple-burst celebratory pulse [0, 120, 60, 160, 60, 260]
  // For standard wins: punchy double-victory rumble [0, 100, 50, 180]
  const pattern = multiplier >= 2
    ? [0, 120, 60, 160, 60, 260]
    : [0, 100, 50, 180];

  triggerHaptic(pattern);
  triggerVisualWinShake();
}

/* --- Toast System --- */
let _toastListeners = new Set();

export function onToast(fn) {
  _toastListeners.add(fn);
  return () => _toastListeners.delete(fn);
}

export function showToast(msg, type = 'emerald') {
  _toastListeners.forEach(fn => fn({ msg, type }));
}

/* --- Win / Lose Outcome Modal System --- */
let _outcomeModalListeners = new Set();

export function onOutcomeModal(fn) {
  _outcomeModalListeners.add(fn);
  return () => _outcomeModalListeners.delete(fn);
}

export function showOutcomeModal(data) {
  _outcomeModalListeners.forEach(fn => fn(data));
}

export function hideOutcomeModal() {
  _outcomeModalListeners.forEach(fn => fn(null));
}

