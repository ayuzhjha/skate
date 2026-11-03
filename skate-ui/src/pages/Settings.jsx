import { useState, useEffect, useCallback } from 'react';
import { Settings as SettingsIcon, ShieldCheck, Volume2, Smartphone, RotateCcw, Key, RefreshCw, Bell, Sparkles, Award } from 'lucide-react';
import { useStore } from '../hooks';
import { api, ApiError } from '../api';
import {
  getState,
  saveState,
  resetState,
  showToast,
  playSound,
  triggerWinVibration,
  showOutcomeModal
} from '../store';
import { triggerRandomEngagementNotification } from '../notificationService';

// Real provably-fair verification: HMAC-SHA256 with key = server_seed and
// message = "client_seed:nonce:cursor". The first 4 bytes (big-endian)
// divided by 2^32 give the round float; dice roll = float × 100.
async function hmacFloat(serverSeed, clientSeed, nonce, cursor) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(serverSeed), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${clientSeed}:${nonce}:${cursor}`));
  const bytes = new Uint8Array(sig);
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  const intVal = (((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0);
  return { hex, floatVal: intVal / 4294967296 };
}

export default function SettingsPage() {
  const state = useStore();
  // Server fairness state (GET /fairness). Local fairness values are gone:
  // the server owns seeds and nonce, and this page only displays them.
  const [fairness, setFairness] = useState(null);
  const [fairnessError, setFairnessError] = useState('');
  const [clientSeedInput, setClientSeedInput] = useState('');
  const [revealedSeed, setRevealedSeed] = useState('');
  const [rotating, setRotating] = useState(false);
  const [savingSeed, setSavingSeed] = useState(false);
  const [verifyServerSeed, setVerifyServerSeed] = useState('');
  const [verifyClientSeed, setVerifyClientSeed] = useState('');
  const [verifyNonce, setVerifyNonce] = useState(1);
  const [verifyCursor, setVerifyCursor] = useState(0);
  const [verifyOutput, setVerifyOutput] = useState(null);
  const [verifying, setVerifying] = useState(false);

  const loadFairness = useCallback(async () => {
    try {
      const f = await api.fairness();
      setFairness(f);
      setFairnessError('');
      setClientSeedInput(f.client_seed);
      setVerifyClientSeed((prev) => prev || f.client_seed);
    } catch (err) {
      setFairnessError(err instanceof ApiError ? err.message : 'Failed to load fairness info');
    }
  }, []);

  useEffect(() => { void loadFairness(); }, [loadFairness]);

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

  const updateClientSeed = async (e) => {
    e.preventDefault();
    if (!clientSeedInput.trim() || savingSeed) return;
    setSavingSeed(true);
    try {
      await api.setClientSeed(clientSeedInput.trim());
      await loadFairness();
      showToast('Client seed updated on the server!', 'emerald');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to update client seed', 'danger');
    } finally {
      setSavingSeed(false);
    }
  };

  const regenerateServerSeed = async () => {
    if (rotating) return;
    setRotating(true);
    try {
      const res = await api.rotateFairness();
      setRevealedSeed(res.revealed_server_seed);
      setVerifyServerSeed(res.revealed_server_seed);
      await loadFairness();
      showToast('Seed rotated — the old seed is revealed below so past rounds stay verifiable', 'gold');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to rotate seed', 'danger');
    } finally {
      setRotating(false);
    }
  };

  const runVerification = async (e) => {
    e.preventDefault();
    if (!verifyServerSeed.trim() || !verifyClientSeed.trim() || verifying) return;
    setVerifying(true);
    try {
      const { hex, floatVal } = await hmacFloat(
        verifyServerSeed.trim(), verifyClientSeed.trim(), verifyNonce, verifyCursor
      );
      setVerifyOutput({ hash: hex, floatVal: floatVal.toFixed(6), diceRoll: +(floatVal * 100).toFixed(2) });
    } catch {
      showToast('Verification failed — this browser may not support WebCrypto', 'danger');
    } finally {
      setVerifying(false);
    }
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

      {/* Provably Fair Seeds (server-owned) */}
      <div className="section-header-row">
        <div className="section-title-wrap">
          <ShieldCheck size={18} color="#00e676" />
          <span className="section-title-text">Provably Fair Engine</span>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>
          Every outcome is pre-committed cryptographically using HMAC-SHA256. Neither the house nor the player can tamper with round generation. The server owns the seeds — this page only displays them.
        </div>

        {fairnessError ? (
          <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 12 }}>
            {fairnessError}
            <button className="btn btn-primary btn-sm" style={{ marginLeft: 10 }} onClick={loadFairness}>Retry</button>
          </div>
        ) : !fairness ? (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>Loading fairness info…</div>
        ) : (
          <>
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
                {fairness.server_seed_hash}
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
                <button type="submit" className="btn btn-primary btn-sm" disabled={savingSeed}>
                  {savingSeed ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>

            {/* Nonce & Rotate */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)' }}>CURRENT NONCE</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 800 }}>#{fairness.nonce}</div>
              </div>
              <button className="btn btn-surface btn-sm" onClick={regenerateServerSeed} disabled={rotating}>
                <RefreshCw size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                {rotating ? 'Rotating…' : 'Rotate Seed (reveal old)'}
              </button>
            </div>

            {revealedSeed && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 4 }}>
                  REVEALED OLD SERVER SEED (PAST ROUNDS STAY VERIFIABLE)
                </div>
                <div style={{
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8,
                  padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: 11, wordBreak: 'break-all',
                  color: 'var(--gold)'
                }}>
                  {revealedSeed}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Cryptographic Verifier Tool */}
      <div className="section-header-row">
        <div className="section-title-wrap">
          <Key size={18} color="#38bdf8" />
          <span className="section-title-text">Outcome Verifier</span>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
          Recompute a past round&apos;s float from its revealed server seed: HMAC-SHA256(key = server seed, message = &quot;client_seed:nonce:cursor&quot;). Dice uses cursor 0; Plinko uses cursors 0–7.
        </div>
        <form onSubmit={runVerification} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
          <input
            type="text"
            value={verifyServerSeed}
            onChange={(e) => setVerifyServerSeed(e.target.value)}
            placeholder="Revealed server seed (paste after a rotation)"
            style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              color: 'var(--text-primary)', padding: '6px 10px', borderRadius: 8,
              fontFamily: 'var(--font-mono)', fontSize: 12
            }}
          />
          <input
            type="text"
            value={verifyClientSeed}
            onChange={(e) => setVerifyClientSeed(e.target.value)}
            placeholder="Client seed"
            style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              color: 'var(--text-primary)', padding: '6px 10px', borderRadius: 8,
              fontFamily: 'var(--font-mono)', fontSize: 12
            }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number"
              min="0"
              value={verifyNonce}
              onChange={(e) => setVerifyNonce(Number(e.target.value))}
              placeholder="Nonce #"
              style={{
                flex: 1, background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', padding: '6px 10px', borderRadius: 8,
                fontFamily: 'var(--font-mono)', fontSize: 12
              }}
            />
            <input
              type="number"
              min="0"
              value={verifyCursor}
              onChange={(e) => setVerifyCursor(Number(e.target.value))}
              placeholder="Cursor"
              style={{
                flex: 1, background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', padding: '6px 10px', borderRadius: 8,
                fontFamily: 'var(--font-mono)', fontSize: 12
              }}
            />
            <button type="submit" className="btn btn-secondary btn-sm" disabled={verifying}>
              {verifying ? 'Computing…' : 'Compute HMAC'}
            </button>
          </div>
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
