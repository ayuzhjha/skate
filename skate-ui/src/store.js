/* State management — local UI state + server wallet sync.
 *
 * The wallet is authoritative on the server now: credits, xp, level and the
 * ledger come from /me and /ledger (see syncWalletFromServer), and every
 * credit movement goes through a server endpoint. What stays local on
 * purpose: mission/achievement progress, streak display, settings, sounds
 * and stats displays. Mission/achievement CREDIT rewards go through
 * POST /wallet/grant — never through a local balance write — so a local
 * grant can never be overwritten by the next server sync.
 *
 * The old local-settlement helpers (recordTransaction, recordGameOutcome,
 * addXp, the toy hash) are gone on purpose: games must never settle
 * locally when the server is down. See recordLocalGameResult, which only
 * updates display stats/progress after a server settlement.
 */

import { api, ApiError } from './api';

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

/* --- Server wallet sync --- */

// Apply an authoritative balance (and xp/level when the server provides
// them, e.g. game responses carry {xp, level} and daily-reward carries
// plain numbers). Never used to invent credits — only server values.
export function applyServerBalance(balance, xpObj = null) {
  const s = getState();
  if (typeof balance === 'number') s.credits = balance;
  if (xpObj) {
    if (typeof xpObj.xp === 'number') s.xp = xpObj.xp;
    if (typeof xpObj.level === 'number') s.level = xpObj.level;
  }
  saveState();
}

function mapServerTx(tx) {
  let ts = '';
  let date = '';
  try {
    const d = new Date(tx.created_at);
    ts = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    date = d.toLocaleDateString();
  } catch {
    ts = tx.created_at || '';
    date = tx.created_at || '';
  }
  return {
    id: tx.tx_id,
    ts,
    date,
    type: tx.tx_type,
    label: tx.label,
    delta: tx.delta,
    balanceAfter: tx.balance_after,
    meta: tx.game_mode || '',
    hash: String(tx.tx_id || '').slice(0, 12),
  };
}

// Fetch /me + /ledger and overwrite the local wallet view. Returns the /me
// payload so callers (auth) can keep the profile in step. Avatar is kept
// local on purpose: the server never changes it, so a sync must not wipe
// the player's picker choice. Throws ApiError on failure; callers decide
// whether to surface it (the server banner covers network failures).
export async function syncWalletFromServer() {
  const me = await api.me();
  const s = getState();
  s.credits = me.credits;
  s.xp = me.xp;
  s.level = me.level;
  s.auth.username = me.username;
  s.auth.email = me.email;
  s.auth.isRegistered = !me.is_guest;
  if (typeof me.streak_day === 'number') s.streak.currentDay = me.streak_day;
  saveState();
  try {
    const page = await api.ledger(100, 0);
    const s2 = getState();
    s2.ledger = (page.transactions || []).map(mapServerTx);
    saveState();
  } catch {
    // Ledger is display-only; a failed ledger fetch must not fail the sync.
  }
  return me;
}

// Shared game-error handling: show the server's message and refresh the
// wallet so the displayed balance matches the server after a rejection
// (e.g. INSUFFICIENT_FUNDS). Never settles anything locally.
export async function handleGameError(err) {
  if (err instanceof ApiError) {
    showToast(err.message, 'danger');
  } else {
    showToast('Something went wrong — please try again', 'danger');
  }
  try {
    await syncWalletFromServer();
  } catch {
    // Server unreachable: the banner already explains it.
  }
}

/* --- Missions --- */
export function updateMissionProgress(id, amount) {
  const s = getState();
  const m = s.missions.find(x => x.id === id);
  if (!m || m.claimed) return;
  m.progress = Math.min(m.target, m.progress + amount);
  saveState();
}

/* Claim a completed mission's SC reward through the server grant endpoint.
 * The idempotency key is derived from the mission id, so a double-click or
 * retry can never pay twice: a DUPLICATE response means the grant already
 * landed, so it still counts as claimed. Returns true when claimed. */
const missionClaiming = new Set();

export async function claimMission(id) {
  const s = getState();
  const m = s.missions.find(x => x.id === id);
  if (!m || m.claimed || m.progress < m.target || missionClaiming.has(id)) return false;
  missionClaiming.add(id);
  try {
    const res = await api.grant('mission', id, m.reward, `mission_${id}`);
    m.claimed = true;
    applyServerBalance(res.credits);
    showToast(`🎯 Claimed +${m.reward} SC!`, 'emerald');
    return true;
  } catch (err) {
    if (err instanceof ApiError && err.code === 'DUPLICATE') {
      m.claimed = true;
      saveState();
      try { await syncWalletFromServer(); } catch {}
      showToast(`🎯 Already claimed +${m.reward} SC!`, 'emerald');
      return true;
    }
    showToast(err instanceof ApiError ? err.message : 'Claim failed — try again', 'danger');
    return false;
  } finally {
    missionClaiming.delete(id);
  }
}

/* --- Achievements (progress local, credits via server grant) --- */
async function grantAchievement(ach) {
  try {
    const res = await api.grant('achievement', ach.id, 200, `ach_${ach.id}`);
    ach.unlocked = true;
    saveState();
    applyServerBalance(res.credits);
    showToast(`🏆 ${ach.title} Unlocked! (+200 SC)`, 'gold');
  } catch (err) {
    if (err instanceof ApiError && err.code === 'DUPLICATE') {
      // Grant already landed on an earlier attempt — unlock without re-paying.
      ach.unlocked = true;
      saveState();
      try { await syncWalletFromServer(); } catch {}
      showToast(`🏆 ${ach.title} Unlocked!`, 'gold');
    } else {
      // Leave it locked so the next settled game retries the grant.
      showToast(err instanceof ApiError ? err.message : 'Achievement reward failed', 'danger');
    }
  }
}

// Check locally-tracked achievement conditions after a settled game. Newly
// eligible achievements fire their server grant (fire-and-forget: the grant
// itself toasts, and a failed grant retries on the next game).
export function checkAchievements() {
  const s = getState();
  const eligible = [];
  const maybe = (id, cond) => {
    const ach = s.achievements.find(a => a.id === id);
    if (ach && !ach.unlocked && cond) eligible.push(ach);
  };
  if (s.stats.wins >= 1) maybe('a_first_win', true);
  if (s.stats.blackjacks >= 1) maybe('a_natural_bj', true);
  if (s.stats.bestWinStreak >= 3) maybe('a_streak3', true);
  if (s.credits >= 5000) maybe('a_bank_5k', true);
  if (s.auth.isRegistered) maybe('a_registered', true);
  eligible.forEach((ach) => { void grantAchievement(ach); });
}

/* --- Local display-only result recording ---
 * Called AFTER a server settlement. Updates stats displays, mission
 * progress and achievement eligibility, and shows the win/lose modal.
 * It never touches credits or the ledger — those come from the server
 * response via applyServerBalance. Sounds are played by the game itself. */
export function recordLocalGameResult(gameName, stake, totalReturn, isSpecial = false) {
  const s = getState();
  const netDelta = Math.round(totalReturn - stake);
  s.stats.totalBets += 1;
  s.stats.totalWagered += stake;
  s.stats.netProfit += netDelta;
  updateMissionProgress('m_play5', 1);
  updateMissionProgress('m_wager1000', stake);

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
        // Reflex Pro unlocks via the grant path like other achievements.
        void grantAchievement(ach);
      }
    }
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

/* Wallet claims — all server-side. The server is the source of truth for
 * eligibility (faucet 1/hour, bailout under 200 SC, streak once/day UTC);
 * a rejection shows the server's message. In-flight guards stop double
 * taps from firing duplicate requests. */
let walletBusy = false;

export async function claimDailyReward() {
  if (walletBusy) return;
  walletBusy = true;
  try {
    const res = await api.dailyReward();
    const s = getState();
    const todayStr = new Date().toISOString().slice(0, 10);
    s.streak.lastClaimDate = todayStr;
    s.streak.totalClaims += 1;
    s.streak.currentDay = res.streak_day;
    applyServerBalance(res.credits, { xp: res.xp, level: res.level });
    playSound('blackjack');
    triggerHaptic([25, 50, 25]);
    showToast(`🎁 Day Streak Claimed! +${res.granted.toLocaleString()} SC`, 'gold');
  } catch (err) {
    showToast(err instanceof ApiError ? err.message : 'Claim failed — try again', 'danger');
  } finally {
    walletBusy = false;
  }
}

export async function claimFaucet() {
  if (walletBusy) return;
  walletBusy = true;
  try {
    const res = await api.faucet();
    applyServerBalance(res.credits);
    playSound('chip');
    showToast('💧 +150 SC Faucet claimed!', 'emerald');
  } catch (err) {
    showToast(err instanceof ApiError ? err.message : 'Faucet failed — try again', 'danger');
  } finally {
    walletBusy = false;
  }
}

export async function claimBailout() {
  if (walletBusy) return;
  walletBusy = true;
  try {
    const res = await api.bailout();
    applyServerBalance(res.credits);
    playSound('win');
    showToast('⚡ +500 SC Bailout added!', 'gold');
  } catch (err) {
    showToast(err instanceof ApiError ? err.message : 'Bailout failed — try again', 'danger');
  } finally {
    walletBusy = false;
  }
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

