/* Login / register screen. Shown on its own (no game nav) until a valid
 * token exists — see the App route guard. */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { ApiError } from '../api';

const inputStyle = {
  width: '100%',
  background: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)',
  padding: '11px 14px',
  borderRadius: 10,
  fontSize: 14,
  boxSizing: 'border-box',
};

export default function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);

  const validate = () => {
    if (mode === 'register' && (username.trim().length < 3 || username.trim().length > 24)) {
      return 'Username must be 3–24 characters.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return 'Enter a valid email address.';
    }
    if (mode === 'register' && password.length < 8) {
      return 'Password must be at least 8 characters.';
    }
    if (mode === 'login' && password.length === 0) {
      return 'Enter your password.';
    }
    return '';
  };

  const submit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      setFieldError(err);
      return;
    }
    setFieldError('');
    setServerError('');
    setBusy(true);
    try {
      if (mode === 'login') await login(email.trim(), password);
      else await register(username.trim(), email.trim(), password);
      navigate('/');
    } catch (e2) {
      setServerError(e2 instanceof ApiError ? e2.message : 'Something went wrong — try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: '28px 4px 20px' }}>
      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <img src="/icon.png" alt="SKATE" style={{ width: 84, height: 84, borderRadius: 22 }} />
        <div style={{ fontSize: 26, fontWeight: 900, marginTop: 10 }}>SKATE</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
          Play-money casino & arcade — sign in to play with your server wallet.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
        <button
          className={`btn ${mode === 'login' ? 'btn-primary' : 'btn-surface'}`}
          onClick={() => { setMode('login'); setFieldError(''); setServerError(''); }}
        >
          Log In
        </button>
        <button
          className={`btn ${mode === 'register' ? 'btn-gold' : 'btn-surface'}`}
          onClick={() => { setMode('register'); setFieldError(''); setServerError(''); }}
        >
          Register
        </button>
      </div>

      <form onSubmit={submit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 18 }}>
        {mode === 'register' && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 4 }}>USERNAME</div>
            <input
              style={inputStyle}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Skater name (3–24 chars)"
              autoComplete="username"
            />
          </div>
        )}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 4 }}>EMAIL</div>
          <input
            style={inputStyle}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            inputMode="email"
          />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 4 }}>PASSWORD</div>
          <input
            style={inputStyle}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          />
        </div>

        {fieldError && (
          <div style={{ fontSize: 12, color: 'var(--red)', fontWeight: 600 }}>{fieldError}</div>
        )}
        {serverError && (
          <div style={{ fontSize: 12, color: 'var(--red)', fontWeight: 600 }}>{serverError}</div>
        )}

        <button type="submit" className="btn btn-primary btn-lg" disabled={busy} style={{ width: '100%' }}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Log In & Play' : 'Create Account & Play'}
        </button>
      </form>

      <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', marginTop: 14, lineHeight: 1.6 }}>
        Demo account (once the backend seed script has run):<br />
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>demo@skate.app / Demo1234</span>
        <br />
        <span style={{ fontSize: 11 }}>Play money only — no real money, ever.</span>
      </div>
    </div>
  );
}
