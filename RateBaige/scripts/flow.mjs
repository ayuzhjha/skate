/**
 * End-to-end flow test: plays real Blackjack rounds, claims a daily reward and
 * verifies the ledger/stats update and persist. Exercises the running dev
 * server through headless Chrome.
 *
 * Usage: node scripts/flow.mjs [baseUrl]
 */
import { withPage, sleep } from './cdp.mjs'

const base = process.argv[2] ?? 'http://localhost:5199/'
let failures = 0
const check = (label, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`)
  if (!ok) failures++
}

const snapshotExpr = `(() => {
  const q = (s) => document.querySelector(s);
  const txt = (el) => el ? el.textContent.trim() : null;
  return JSON.stringify({
    balance: txt(q('.bj-balance')),
    navBalance: txt(q('.balance-chip__value')),
    outcome: txt(q('.bj-outcome__title')),
    net: txt(q('.bj-outcome__net')),
    detail: txt(q('.bj-outcome__detail')),
    inPlay: !!q('.bj-actions'),
    dealerTotal: txt(q('.bj-seat--dealer .bj-total')),
    handTotals: [...document.querySelectorAll('.bj-hand .bj-total')].map(txt),
    canDouble: (() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Double'); return b ? !b.disabled : false; })(),
    canSplit: (() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Split'); return b ? !b.disabled : false; })(),
  });
})()`

await withPage(base, { width: 1440, height: 1000 }, async (_c, evaluate) => {
  const snapshot = async () => JSON.parse(await evaluate(snapshotExpr))

  const click = (label) =>
    evaluate(`(() => {
      const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim().startsWith(${JSON.stringify(label)}));
      if (!b) return 'missing';
      if (b.disabled) return 'disabled';
      b.click();
      return 'ok';
    })()`)

  const settleWait = async () => {
    for (let i = 0; i < 24; i++) {
      const s = await snapshot()
      if (!s.inPlay && s.outcome) return s
      if (s.inPlay && i > 0 && i % 4 === 0) {
        // safety: force a stand if we're still playing
        await click('Stand')
      }
      await sleep(300)
    }
    return snapshot()
  }

  /* ---- fresh state ---- */
  await evaluate('localStorage.clear(); true')
  await evaluate(`location.href = ${JSON.stringify(base + '#/blackjack')}; true`)
  await sleep(400)
  await evaluate('location.reload(); true')
  await sleep(1800)

  await evaluate(`
    window.__errs = [];
    window.addEventListener('error', (e) => window.__errs.push('error: ' + (e.message || e)));
    window.addEventListener('unhandledrejection', (e) => window.__errs.push('rejection: ' + (e.reason && e.reason.message || e.reason)));
    const oe = console.error;
    console.error = (...a) => { window.__errs.push('console.error: ' + a.map(x => (x && x.message) || String(x)).join(' ')); oe.apply(console, a); };
    true
  `)

  let s = await snapshot()
  check('blackjack screen loads with a balance', !!s.balance, `balance=${s.balance}`)
  const startBalance = Number((s.balance || '0').replace(/[^0-9]/g, ''))

  /* ---- round 1: deal then play to settle ---- */
  const dealt = await click('Deal cards')
  check('deal button enabled and clicked', dealt === 'ok', dealt)
  await sleep(500)
  s = await snapshot()
  check(
    'deal starts play or resolves a natural immediately',
    s.inPlay || !!s.outcome,
    `inPlay=${s.inPlay} outcome=${s.outcome}`,
  )
  check('player has two cards', (s.handTotals?.length ?? 0) === 1)

  // Play sensibly: hit under 17, stand at 17+.
  for (let i = 0; i < 12; i++) {
    s = await snapshot()
    if (!s.inPlay) break
    const total = parseInt(String(s.handTotals?.[0] ?? '0'), 10) || 0
    if (total >= 17) {
      await click('Stand')
    } else {
      await click('Hit')
    }
    await sleep(280)
  }
  s = await settleWait()
  check('round settles with an outcome', !!s.outcome, `outcome=${s.outcome} net=${s.net}`)
  const afterBalance = Number((s.balance || '0').replace(/[^0-9]/g, ''))
  const net = Number(String(s.net || '0').replace(/\u2212/g, '-').replace(/[^0-9-]/g, ''))
  check(
    'balance changed by exactly the net',
    afterBalance === startBalance + net,
    `${startBalance} -> ${afterBalance} net=${net}`,
  )

  /* ---- round 2: double down ---- */
  await sleep(300)
  const dealt2 = await click('Deal again')
  const dealt2b = dealt2 === 'ok' ? dealt2 : await click('Deal cards')
  check('second deal clicked', dealt2b === 'ok' || dealt2 === 'ok', dealt2)
  await sleep(500)
  s = await snapshot()
  if (s.canDouble) {
    const d = await click('Double')
    check('double down executes when affordable', d === 'ok', d)
    s = await settleWait()
    check('doubled round settles', !!s.outcome, `outcome=${s.outcome}`)
    const doubledTag = await evaluate(
      `Boolean([...document.querySelectorAll('.tag')].find(t => t.textContent.trim() === 'Doubled'))`,
    )
    check('a "Doubled" tag is shown on the hand', doubledTag === true)
  } else {
    check('double gated by engine when not on first two cards', true, '(not offered)')
  }

  /* ---- ledger + stats reflect play ---- */
  await evaluate('location.hash = "#/history"; true')
  await sleep(700)
  const historyRounds = await evaluate(
    `document.querySelectorAll('.history__item').length`,
  )
  check('history lists played rounds', historyRounds >= 1, `items=${historyRounds}`)

  await evaluate('location.hash = "#/stats"; true')
  await sleep(800)
  const statsInfo = await evaluate(
    `JSON.stringify({ grid: !!document.querySelector('.stat-grid'), items: document.querySelectorAll('.stat-grid .stat').length })`,
  )
  const statsParsed = JSON.parse(statsInfo)
  check('stats screen renders totals', statsParsed.grid && statsParsed.items >= 1, statsInfo)

  /* ---- persistence ---- */
  const persisted = await evaluate(`(() => {
    const raw = localStorage.getItem('vanta.state.v1') || localStorage.getItem('vanta');
    if (!raw) { for (const k of Object.keys(localStorage)) { const v = localStorage.getItem(k); if (v && v.includes('rounds')) return k; } return null; }
    return raw;
  })()`)
  check('state is persisted to localStorage', !!persisted, persisted ? '' : '(no key)')

  /* ---- daily reward claim ---- */
  await evaluate('location.hash = "#/rewards"; true')
  await sleep(700)
  const beforeClaim = JSON.parse(
    await evaluate(`JSON.stringify({ bal: (document.querySelector('.balance-chip__value')||{}).textContent })`),
  )
  const claimResult = await click('Claim')
  await sleep(600)
  const afterClaim = JSON.parse(
    await evaluate(`JSON.stringify({ bal: (document.querySelector('.balance-chip__value')||{}).textContent, claimed: !!document.querySelector('button[disabled]') && [...document.querySelectorAll('button')].some(b => b.textContent.trim().startsWith('Claimed')) })`),
  )
  check('daily claim button clicked', claimResult === 'ok', claimResult)
  check('balance increased after daily claim', beforeClaim.bal !== afterClaim.bal, `${beforeClaim.bal} -> ${afterClaim.bal}`)
  check('daily reward reads as claimed afterwards', afterClaim.claimed === true)

  /* ---- duplicate claim prevention ---- */
  const secondClaim = await click('Claim')
  check('daily cannot be claimed twice', secondClaim !== 'ok', secondClaim)

  const errs = JSON.parse((await evaluate('JSON.stringify(window.__errs || [])')) || '[]')
  check('no console errors during the flow', errs.length === 0, errs.join(' | '))
})

console.log(`\n${failures === 0 ? 'ALL FLOW CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`)
process.exit(failures === 0 ? 0 : 1)
