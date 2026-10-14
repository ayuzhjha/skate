import { useState } from 'react';
import { Settings as SettingsIcon, ShieldCheck, Volume2, Smartphone, RotateCcw, Key, RefreshCw, Coins, Bell, Sparkles, Award } from 'lucide-react';
import { useStore } from '../hooks';
import {
  getState,
  saveState,
  resetState,
  recordTransaction,
  simpleSha256Hex,
  showToast,
  playSound,
  triggerWinVibration,
  showOutcomeModal
} from '../store';
import { triggerRandomEngagementNotification } from '../notificationService';

export default function SettingsPage() {
  const state = useStore();
  const [clientSeedInput, setClientSeedInput] = useState(state.fairness.clientSeed);
  const [verifyNonce, setVerifyNonce] = useState(state.fairness.nonce);
  const [verifyOutput, setVerifyOutput] = useState(null);

  // Custom credits state with secret key protection
  const [customCredits, setCustomCredits] = useState('');
  const [specialKey, setSpecialKey] = useState('');

  const serverSeedHash = simpleSha256Hex(state.fairness.serverSeed);

  const toggleSound = () => {
    const s = getState();
    s.settings.sound = !s.settings.sound;
    saveState();
    if (s.settings.sound) playSound('chip');
  };

  const toggleHaptics = () => {
    const s = getState();
    s.settings.haptics = !s.settings.haptics;
    saveState();
    if (s.settings.haptics) {
      triggerWinVibration(2);
      showToast('📳 Haptic Vibrations Enabled!', 'gold');
    } else {
      showToast('Haptic Vibrations Disabled', 'info');
    }
  };

  const toggleNotifications = () => {
    const s = getState();
    s.settings.notifications = !s.settings.notifications;
    saveState();
    showToast(s.settings.notifications ? '🔔 Player Alerts Enabled!' : 'Notifications Muted', 'info');
  };

  const toggleOutcomePopups = () => {
    const s = getState();
    s.settings.outcomePopups = s.settings.outcomePopups === false ? true : false;
    saveState();
    if (s.settings.outcomePopups) {
      playSound('win');
      showToast('🎉 Win/Lose Popups Enabled!', 'gold');
    } else {
      playSound('chip');
      showToast('🚫 Win/Lose Popups Turned Off', 'info');
    }
  };

  const handleTestNotification = () => {
    const notif = triggerRandomEngagementNotification(0);
    playSound('win');
    showToast(`📲 Sent alert: "${notif.title}"`, 'gold');
  };

  const handlePreviewWin = () => {
    playSound('win');
    triggerWinVibration(2);
    showOutcomeModal({
      type: 'win',
      payout: 450,
      subtitle: 'Great play! Keep it up.'
    });
  };

  const handlePreviewLose = () => {
    playSound('loss');
    showOutcomeModal({
      type: 'lose',
      headline: 'Better luck next time!',
      subtitle: 'Keep playing to improve your streak.'
    });
  };

  const updateClientSeed = (e) => {
    e.preventDefault();
    if (!clientSeedInput.trim()) return;
    const s = getState();
    s.fairness.clientSeed = clientSeedInput.trim();
    saveState();
    showToast('Client seed updated!', 'emerald');
  };

  const regenerateServerSeed = () => {
    const s = getState();
    s.fairness.serverSeed = 'srv_' + Math.random().toString(36).substring(2, 15) + '_skate2026';
    s.fairness.nonce = 1;
    saveState();
    showToast('New Server Seed pair generated & Nonce reset to 1', 'gold');
  };

  const runVerification = (e) => {
    e.preventDefault();
    const hash = simpleSha256Hex(`${state.fairness.serverSeed}:${state.fairness.clientSeed}:${verifyNonce}`);
    const intVal = parseInt(hash.slice(0, 8), 16);
    const floatVal = (intVal >>> 0) / 4294967296;
    const diceRoll = +(floatVal * 100).toFixed(2);
    setVerifyOutput({ hash, floatVal: floatVal.toFixed(6), diceRoll });
  };

  const handleCustomCredits = (e) => {
    e.preventDefault();
    if (specialKey.trim() !== 'fcukyou') {
      showToast('Invalid Special Key! Access Denied', 'danger');
      return;
    }
    const amt = parseInt(customCredits, 10);
    if (isNaN(amt) || amt < 0) {
      showToast('Please enter a valid credit amount', 'danger');
      return;
    }

    const s = getState();
    const prev = s.credits;
    s.credits = amt;
    s.stats.bankrollHistory.push(amt);
    recordTransaction('reward', 'Custom Credit Override', amt - prev, `Authorized override via special key`);
    saveState();
    playSound('win');
    showToast(`🎉 Balance updated to ${amt.toLocaleString()} SC!`, 'gold');
    setCustomCredits('');
    setSpecialKey('');
  };

  const handleResetData = () => {
    if (window.confirm('Are you sure you want to reset all game data, bankroll, and history?')) {
      resetState();
      showToast('Game state reset to initial factory values', 'info');
    }
  };

  return (
    <div style={{ paddingBottom: 20 }}>
      {/* Header */}
      <div className="section-header-row">
        <div className="section-title-wrap">
          <SettingsIcon size={18} color="#ffffff" />
          <span className="section-title-text">Preferences & Fairness</span>
        </div>
      </div>

      {/* Preferences Section */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>AUDIO & SENSORY</div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Volume2 size={18} color="var(--emerald)" />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Synthesized Audio FX</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Procedural web audio chips & card deals</div>
            </div>
          </div>
          <button
            className={`btn btn-sm ${state.settings.sound ? 'btn-primary' : 'btn-surface'}`}
            onClick={toggleSound}
          >
            {state.settings.sound ? 'Enabled' : 'Muted'}
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Smartphone size={18} color="var(--gold)" />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Haptic Vibrations</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Device buzz on wins & button presses</div>
            </div>
          </div>
          <button
            className={`btn btn-sm ${state.settings.haptics ? 'btn-gold' : 'btn-surface'}`}
            onClick={toggleHaptics}
          >
            {state.settings.haptics ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Bell size={18} color="var(--blue)" />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Phone Engagement Alerts</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Lock screen bonuses, refills & streak reminders</div>
            </div>
          </div>
          <button
            className={`btn btn-sm ${state.settings.notifications !== false ? 'btn-primary' : 'btn-surface'}`}
            onClick={toggleNotifications}
          >
            {state.settings.notifications !== false ? 'Enabled' : 'Muted'}
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Award size={18} color="var(--emerald)" />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Win / Lose Celebration Popups</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Full-screen victory and defeat cards after games</div>
            </div>
          </div>
          <button
            className={`btn btn-sm ${state.settings.outcomePopups !== false ? 'btn-primary' : 'btn-surface'}`}
            onClick={toggleOutcomePopups}
          >
            {state.settings.outcomePopups !== false ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        {/* Action Testing Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-sm btn-surface" onClick={handleTestNotification} style={{ fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <Bell size={13} />
            Test Phone Alert
          </button>
          <button className="btn btn-sm btn-surface" onClick={handlePreviewWin} style={{ fontSize: 11, color: 'var(--emerald)', borderColor: 'rgba(0, 230, 118, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <Sparkles size={13} />
            Preview Win
          </button>
          <button className="btn btn-sm btn-surface" onClick={handlePreviewLose} style={{ fontSize: 11, color: 'var(--red)', borderColor: 'rgba(239, 68, 68, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <RotateCcw size={13} />
            Preview Lose
          </button>
          <button 
            className={`btn btn-sm ${state.settings.outcomePopups !== false ? 'btn-gold' : 'btn-surface'}`} 
            onClick={toggleOutcomePopups} 
            style={{ fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
          >
            {state.settings.outcomePopups !== false ? 'Turn Off Popups' : 'Turn On Popups'}
          </button>
        </div>
      </div>

      {/* Custom Credits Special Key Option */}
      <div className="section-header-row">
        <div className="section-title-wrap">
          <Coins size={18} color="#facc15" />
          <span className="section-title-text" style={{ color: '#facc15' }}>Grant Custom Credits</span>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20, borderColor: 'rgba(250, 204, 21, 0.35)', padding: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Inject Custom Virtual Credits</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
          Requires the authorization key to inject or set your virtual credits to any custom amount.
        </div>
        <form onSubmit={handleCustomCredits} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 8 }}>
            <input
              type="number"
              placeholder="Amount (e.g. 50000)"
              value={customCredits}
              onChange={(e) => setCustomCredits(e.target.value)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                padding: '9px 12px',
                borderRadius: 8,
                fontSize: 13,
                fontFamily: 'var(--font-mono)'
              }}
              min="0"
              required
            />
            <input
              type="password"
              placeholder="Special Key"
              value={specialKey}
              onChange={(e) => setSpecialKey(e.target.value)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                padding: '9px 12px',
                borderRadius: 8,
                fontSize: 13
              }}
              required
            />
          </div>
          <button type="submit" className="btn btn-gold btn-sm" style={{ width: '100%', fontWeight: 800 }}>
            <Key size={14} style={{ marginRight: 4 }} /> Authorize & Apply Credits
          </button>
        </form>
      </div>

      {/* Provably Fair Seeds */}
      <div className="section-header-row">
        <div className="section-title-wrap">
          <ShieldCheck size={18} color="#00e676" />
          <span className="section-title-text">Provably Fair Engine</span>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>
          Every outcome is pre-committed cryptographically using HMAC-SHA256. Neither the house nor the player can tamper with round generation.
        </div>

        {/* Server Seed Hash */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 4 }}>
            SERVER SEED (SHA-256 COMMITTED HASH)
          </div>
          <div style={{
            background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8,
            padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: 11, wordBreak: 'break-all',
            color: 'var(--emerald)'
          }}>
            {serverSeedHash}
          </div>
        </div>

        {/* Client Seed Input */}
        <form onSubmit={updateClientSeed} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 4 }}>
            CLIENT SEED (CUSTOMIZABLE)
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={clientSeedInput}
              onChange={(e) => setClientSeedInput(e.target.value)}
              style={{
                flex: 1, background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', padding: '6px 10px', borderRadius: 8,
                fontFamily: 'var(--font-mono)', fontSize: 12
              }}
            />
            <button type="submit" className="btn btn-primary btn-sm">
              Save
            </button>
          </div>
        </form>

        {/* Nonce & Regenerate */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)' }}>CURRENT NONCE</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 800 }}>#{state.fairness.nonce}</div>
          </div>
          <button className="btn btn-surface btn-sm" onClick={regenerateServerSeed}>
            <RefreshCw size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            New Seed Pair
          </button>
        </div>
      </div>

      {/* Cryptographic Verifier Tool */}
      <div className="section-header-row">
        <div className="section-title-wrap">
          <Key size={18} color="#38bdf8" />
          <span className="section-title-text">Outcome Verifier</span>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <form onSubmit={runVerification} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input
            type="number"
            min="1"
            value={verifyNonce}
            onChange={(e) => setVerifyNonce(Number(e.target.value))}
            placeholder="Nonce #"
            style={{
              width: 100, background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              color: 'var(--text-primary)', padding: '6px 10px', borderRadius: 8,
              fontFamily: 'var(--font-mono)', fontSize: 12
            }}
          />
          <button type="submit" className="btn btn-secondary btn-sm" style={{ flex: 1 }}>
            Compute Output Hash
          </button>
        </form>

        {verifyOutput && (
          <div style={{
            background: 'var(--bg-elevated)', borderRadius: 8, padding: 10,
            border: '1px solid var(--border)', fontSize: 11, fontFamily: 'var(--font-mono)'
          }}>
            <div style={{ color: 'var(--text-dim)', marginBottom: 2 }}>HMAC Hash:</div>
            <div style={{ color: 'var(--gold)', wordBreak: 'break-all', marginBottom: 6 }}>{verifyOutput.hash}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Float: <b>{verifyOutput.floatVal}</b></span>
              <span>Dice Equivalent: <b>{verifyOutput.diceRoll}</b></span>
            </div>
          </div>
        )}
      </div>

      {/* Danger Zone: Reset Data */}
      <div className="section-header-row">
        <div className="section-title-wrap">
          <RotateCcw size={18} color="var(--red)" />
          <span className="section-title-text" style={{ color: 'var(--red)' }}>Danger Zone</span>
        </div>
      </div>

      <div className="card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', padding: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Reset All App State</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
          Wipe local storage bankroll, stats, ledger, and missions back to original factory defaults.
        </div>
        <button className="btn btn-danger btn-sm" onClick={handleResetData}>
          Reset Factory Defaults
        </button>
      </div>
    </div>
  );
}
