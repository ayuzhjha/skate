import { useState } from 'react';
import { History as HistoryIcon, ShieldCheck, ArrowDownRight, ArrowUpRight, Filter } from 'lucide-react';
import { useStore } from '../hooks';

export default function HistoryPage() {
  const state = useStore();
  const [filter, setFilter] = useState('all'); // 'all' | 'bet' | 'reward'

  const filtered = state.ledger.filter(tx => {
    if (filter === 'all') return true;
    return tx.type === filter;
  });

  return (
    <div>
      {/* Header */}
      <div className="section-header">
        <span className="section-title"><HistoryIcon size={16} /> Transaction Ledger</span>
        <span className="tag tag-emerald">
          <ShieldCheck size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          Cryptographically Verified
        </span>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        <button
          className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-surface'}`}
          onClick={() => setFilter('all')}
        >
          All Activity ({state.ledger.length})
        </button>
        <button
          className={`btn btn-sm ${filter === 'bet' ? 'btn-primary' : 'btn-surface'}`}
          onClick={() => setFilter('bet')}
        >
          Game Wagers & Payouts
        </button>
        <button
          className={`btn btn-sm ${filter === 'reward' ? 'btn-gold' : 'btn-surface'}`}
          onClick={() => setFilter('reward')}
        >
          Bonuses & Quests
        </button>
      </div>

      {/* Ledger Records */}
      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '36px 20px' }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>📜</div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>No Transactions Found</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Play any arcade game or claim daily bonuses to generate cryptographic audit records.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(tx => {
            const isPos = tx.delta >= 0;

            return (
              <div key={tx.id} className="card" style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: isPos ? 'rgba(46, 204, 113, 0.15)' : 'rgba(231, 76, 60, 0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {isPos ? (
                        <ArrowUpRight size={16} color="var(--emerald)" />
                      ) : (
                        <ArrowDownRight size={16} color="var(--red)" />
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{tx.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        {tx.ts} · {tx.date}
                      </div>
                    </div>
                  </div>

                  {/* Delta & Balance */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 14,
                      fontWeight: 800,
                      color: isPos ? 'var(--emerald)' : 'var(--red)'
                    }}>
                      {isPos ? `+${tx.delta.toLocaleString()}` : tx.delta.toLocaleString()} SC
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                      Bal: {tx.balanceAfter.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Sub details & SHA-256 Hash */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  fontSize: 11, borderTop: '1px solid var(--border)', paddingTop: 6, marginTop: 4
                }}>
                  <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                    {tx.meta || 'Authorized transaction'}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)',
                    background: 'var(--bg-elevated)', padding: '1px 6px', borderRadius: 4
                  }}>
                    hash: {tx.hash}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
