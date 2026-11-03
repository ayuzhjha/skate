/* Auth state: JWT token in localStorage ('skate_token') + /me profile.
 *
 * On load, a stored token is validated via GET /me; a 401 clears it so a
 * stale token can never leave the app thinking it is logged in. refreshWallet
 * re-fetches /me (and the ledger) through the store's server sync and keeps
 * the profile in step with it.
 */

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, setToken, getToken, ApiError } from './api';
import { syncWalletFromServer, getState, saveState } from './store';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      try {
        const me = await syncWalletFromServer();
        if (!cancelled) setUser(me);
      } catch (err) {
        // A 401 means the token is dead — drop it so the login screen shows.
        // Any other failure (server down) keeps the token; the banner covers it.
        if (err instanceof ApiError && err.status === 401) {
          setToken(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const applyLogin = useCallback(async (resp) => {
    setToken(resp.access_token);
    setUser(resp.user);
    // Pull authoritative wallet state (credits/xp/level/streak) right away.
    try {
      const me = await syncWalletFromServer();
      setUser(me);
    } catch {
      // Wallet sync failure is surfaced by the server banner; login stands.
    }
  }, []);

  const login = useCallback(async (email, password) => {
    const resp = await api.login(email, password);
    await applyLogin(resp);
    return resp;
  }, [applyLogin]);

  const register = useCallback(async (username, email, password) => {
    const resp = await api.register(username, email, password);
    await applyLogin(resp);
    return resp;
  }, [applyLogin]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    const s = getState();
    s.auth = { ...s.auth, isRegistered: false, username: 'Skater_Guest', email: '' };
    saveState();
  }, []);

  const refreshWallet = useCallback(async () => {
    const me = await syncWalletFromServer();
    setUser(me);
    return me;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshWallet }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
