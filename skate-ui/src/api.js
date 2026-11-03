/* API client for the SKATE FastAPI backend (server/).
 *
 * Base URL comes from VITE_API_URL (default http://localhost:8000).
 * Auth token lives in localStorage under 'skate_token' and is sent as a
 * Bearer header. Backend errors use the envelope
 * {"detail": {"code": "...", "message": "..."}} — those are parsed into
 * ApiError with .code / .message / .status so the UI can show the server's
 * own message instead of a stack trace.
 *
 * Network failures surface as ApiError with code 'NETWORK' and a plain
 * message telling the player to start the backend. The module also tracks
 * server reachability (onServerStatus) so App can show a banner instead of
 * letting games silently settle locally when the server is down — they never
 * do: every game result comes from a server response.
 */

const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const TOKEN_KEY = 'skate_token';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

export class ApiError extends Error {
  constructor(code, message, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export function newIdempotency() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// --- server reachability -------------------------------------------------
let reachable = true;
const reachListeners = new Set();

function setReachable(value) {
  if (value === reachable) return;
  reachable = value;
  reachListeners.forEach((fn) => fn(reachable));
}

export function onServerStatus(fn) {
  reachListeners.add(fn);
  return () => reachListeners.delete(fn);
}

export function isServerReachable() {
  return reachable;
}

// --- core fetch ----------------------------------------------------------
async function req(path, { method = 'GET', body = null, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
    });
  } catch {
    setReachable(false);
    throw new ApiError('NETWORK', 'Server unreachable — start the backend (see server docs)', 0);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const detail = data && data.detail;
    const code = (detail && detail.code) || `HTTP_${res.status}`;
    const message = (detail && detail.message) || `Request failed (${res.status})`;
    // A responded server is reachable even when it rejects the request.
    setReachable(true);
    throw new ApiError(code, message, res.status);
  }

  setReachable(true);
  return data;
}

const get = (path, auth = true) => req(path, { method: 'GET', auth });
const post = (path, body, auth = true) => req(path, { method: 'POST', body, auth });

export const api = {
  // Auth
  register: (username, email, password) => post('/api/v1/auth/register', { username, email, password }, false),
  login: (email, password) => post('/api/v1/auth/login', { email, password }, false),

  // Account
  me: () => get('/api/v1/me'),
  ledger: (limit = 100, offset = 0) => get(`/api/v1/ledger?limit=${limit}&offset=${offset}`),

  // Fairness
  fairness: () => get('/api/v1/fairness'),
  setClientSeed: (client_seed) => post('/api/v1/fairness/client-seed', { client_seed }),
  rotateSeed: () => post('/api/v1/fairness/rotate', {}),

  // Wallet
  faucet: () => post('/api/v1/wallet/faucet', {}),
  bailout: () => post('/api/v1/wallet/bailout', {}),
  dailyReward: () => post('/api/v1/wallet/daily-reward', {}),
  grant: (kind, ref, amount, idempotency_key) =>
    post('/api/v1/wallet/grant', { kind, ref, amount, idempotency_key }),

  // Games
  plinko: (stake, risk, idempotency_key) => post('/api/v1/games/plinko', { stake, risk, idempotency_key }),
  mines: (stake, bombs, gems_picked, idempotency_key) =>
    post('/api/v1/games/mines', { stake, bombs, gems_picked, idempotency_key }),
  minesBomb: (stake, idempotency_key) =>
    post('/api/v1/games/mines/bomb', { stake, idempotency_key }),
  dice: (stake, mode, target, idempotency_key) =>
    post('/api/v1/games/dice', { stake, mode, target, idempotency_key }),
  crash: (stake, bailout_mult, idempotency_key) =>
    post('/api/v1/games/crash', { stake, bailout_mult, idempotency_key }),
  reflex: (stake, stop_pos_pct, turbo, idempotency_key) =>
    post('/api/v1/games/reflex', { stake, stop_pos_pct, turbo, idempotency_key }),
  blackjackDeal: (stake, idempotency_key) => post('/api/v1/games/blackjack/deal', { stake, idempotency_key }),
  blackjackAction: (hand_id, action) => post(`/api/v1/games/blackjack/${hand_id}/action`, { action }),
  blackjackGet: (hand_id) => get(`/api/v1/games/blackjack/${hand_id}`),

  // Billing (dummy payments — no real money, no card data anywhere)
  plans: () => get('/api/v1/billing/plans', false),
  checkout: (kind, ref, idempotency_key) => post('/api/v1/billing/checkout', { kind, ref, idempotency_key }),
  payments: () => get('/api/v1/billing/payments'),
  subscription: () => get('/api/v1/billing/subscriptions'),
  cancelSubscription: () => post('/api/v1/billing/subscriptions/cancel', {}),
};
