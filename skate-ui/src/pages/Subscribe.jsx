/* Subscribe page: dummy billing only.
 *
 * Plans + credit packs come from GET /billing/plans. Checkout is a single
 * clearly-labelled dummy button per item — there are NO card-number or
 * card-detail fields anywhere on this page (or anywhere in the app). The
 * server instantly records a FAKE successful payment; no real money moves.
 */

import { useState, useEffect, useCallback } from 'react';
import { api, ApiError, newIdempotency } from '../api';
import { useAuth } from '../auth';
import { showToast } from '../store';

export default function SubscribePage() {
  const { refreshWallet } = useAuth();
  const [plans, setPlans] = useState([]);
  const [packs, setPacks] = useState([]);
  const [notice, setNotice] = useState('');
  const [payments, setPayments] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [pendingKey, setPendingKey] = useState(null);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const [plansRes, payRes, subRes] = await Promise.all([
        api.plans(),
        api.payments(),
        api.subscription(),
      ]);
      setPlans(plansRes.plans || []);
      setPacks(plansRes.packs || []);
      setNotice(plansRes.notice || '');
      setPayments(payRes.payments || []);
      setSubscription(subRes.subscription);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load billing info');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const checkout = async (kind, ref) => {
    const key = `${kind}:${ref}`;
    if (pendingKey) return;
    setPendingKey(key);
    try {
      const res = await api.checkout(kind, ref, newIdempotency());
      if (res.duplicate) {
        showToast('Already processed — showing the original receipt', 'info');
      } else {
        showToast(`Dummy payment succeeded — receipt ${res.payment.fake_receipt}`, 'gold');
      }
      try { await refreshWallet(); } catch {}
      await load();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Checkout failed', 'danger');
    } finally {
      setPendingKey(null);
    }
  };

  const cancel = async () => {
    if (pendingKey) return;
    setPendingKey('cancel');
    try {
      await api.cancelSubscription();
      showToast('Subscription cancelled', 'info');
      await load();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Cancel failed', 'danger');
    } finally {
      setPendingKey(null);
    }
  };

  if (loading) {
    return <div className="card" style={{ padding: 20, textAlign: 'center' }}>Loading billing…</div>;
  }

  if (loadError) {
    return (
      <div className="card" style={{ padding: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Couldn&apos;t load billing</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>{loadError}</div>
        <button className="btn btn-primary btn-sm" onClick={() => { setLoading(true); void load(); }}>Retry</button>
      </div>
    );
  }

  return (
    <div>
      <div className="section-header-row">
        <div className="section-title-wrap">
          <span className="section-title-text">Subscribe & Credit Packs</span>
        </div>
      </div>

      {notice && (
        <div className="card" style={{ padding: 12, marginBottom: 14, borderColor: 'rgba(250, 204, 21, 0.35)' }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>⚠️ {notice}</span>
        </div>
      )}

      {subscription && (
        <div className="card" style={{ padding: 14, marginBottom: 14, borderColor: 'var(--emerald)' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--emerald)' }}>
            Active plan: {subscription.plan_id} ({subscription.status})
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            Renews / ends: {subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : '—'}
          </div>
          <button
            className="btn btn-surface btn-sm"
            style={{ marginTop: 10 }}
            onClick={cancel}
            disabled={pendingKey !== null}
          >
            {pendingKey === 'cancel' ? 'Cancelling…' : 'Cancel Subscription'}
          </button>
        </div>
      )}

      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-dim)', marginBottom: 8 }}>SUBSCRIPTION PLANS</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {plans.map((p) => (
          <div key={p.plan_id} className="card" style={{ padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {p.price_display}{p.monthly_sc ? ` · +${p.monthly_sc.toLocaleString()} SC / month` : ' · no monthly bonus'}
              </div>
            </div>
            {p.plan_id !== 'free' && (
              <button
                className="btn btn-gold btn-sm"
                onClick={() => checkout('subscription', p.plan_id)}
                disabled={pendingKey !== null}
              >
                {pendingKey === `subscription:${p.plan_id}` ? 'Processing…' : 'Pay (dummy — no real money)'}
              </button>
            )}
          </div>
        ))}
      </div>

      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-dim)', marginBottom: 8 }}>CREDIT PACKS</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {packs.map((pk) => (
          <div key={pk.pack_id} className="card" style={{ padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>+{pk.sc.toLocaleString()} SC</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{pk.price_display}</div>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => checkout('credits_pack', pk.pack_id)}
              disabled={pendingKey !== null}
            >
              {pendingKey === `credits_pack:${pk.pack_id}` ? 'Processing…' : 'Pay (dummy — no real money)'}
            </button>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-dim)', marginBottom: 8 }}>PAST PAYMENTS (FAKE RECEIPTS)</div>
      {payments.length === 0 ? (
        <div className="card" style={{ padding: 14, textAlign: 'center', fontSize: 12, color: 'var(--text-secondary)' }}>
          No payments yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {payments.map((pay) => (
            <div key={pay.payment_id} className="card" style={{ padding: '10px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700 }}>
                <span>{pay.kind === 'credits_pack' ? 'Credit pack' : 'Subscription'} · {pay.ref}</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{pay.amount_display}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                <span>{pay.status} · +{pay.amount_sc.toLocaleString()} SC</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{pay.fake_receipt}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
