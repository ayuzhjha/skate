/**
 * Low-balance refill test: seeds a sub-threshold balance, then verifies the
 * free refill is offered, payable once, and un-offered afterwards.
 *
 * Usage: node scripts/refill.mjs [baseUrl]
 */
import { withPage, sleep } from './cdp.mjs'

const base = process.argv[2] ?? 'http://localhost:5199/'
let failures = 0
const check = (label, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`)
  if (!ok) failures++
}

await withPage(base, { width: 1440, height: 1000 }, async (_c, evaluate) => {
  const clickText = (text) =>
    evaluate(`(() => {
      const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === ${JSON.stringify(text)});
      if (!b) return 'missing'; if (b.disabled) return 'disabled'; b.click(); return 'ok';
    })()`)

  await evaluate('localStorage.clear(); true')
  await evaluate('location.hash = "#/rewards"; true')
  await evaluate('location.reload(); true')
  await sleep(1600)

  // Seed a low balance with the refill cooldown elapsed.
  const raw = JSON.parse(await evaluate(`localStorage.getItem('vanta.state.v1')`))
  raw.balance = 50
  raw.rewards.refillAt = null
  const payload = JSON.stringify(raw)
  await evaluate(`localStorage.setItem('vanta.state.v1', ${JSON.stringify(payload)}); true`)
  await evaluate('location.reload(); true')
  await sleep(1600)

  const low = JSON.parse(
    await evaluate(`JSON.stringify({ bal: (document.querySelector('.balance-chip__value')||{}).textContent, offered: [...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Claim 500 VC') })`),
  )
  check('seeded low balance is shown', /50/.test(low.bal || ''), `bal=${low.bal}`)
  check('free refill is offered when balance is low', low.offered === true)

  const claim = await clickText('Claim 500 VC')
  await sleep(700)
  const after = JSON.parse(
    await evaluate(`JSON.stringify({ bal: (document.querySelector('.balance-chip__value')||{}).textContent, offered: [...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Claim 500 VC') })`),
  )
  check('refill credits the account', claim === 'ok' && /550/.test(after.bal || ''), `${low.bal} -> ${after.bal}`)
  check('refill disappears once the balance is healthy', after.offered === false)

  // Home banner should also be gone and the balance consistent there.
  await evaluate('location.hash = "#/"; true')
  await sleep(600)
  const home = await evaluate(`(document.querySelector('.balance-chip__value')||{}).textContent`)
  check('balance is consistent on Home', /550/.test(home || ''), `home=${home}`)

  // Cooldown: drop balance again without clearing refillAt -> not offered.
  const raw2 = JSON.parse(await evaluate(`localStorage.getItem('vanta.state.v1')`))
  raw2.balance = 20
  await evaluate(`localStorage.setItem('vanta.state.v1', ${JSON.stringify(JSON.stringify(raw2))}); true`)
  await evaluate('location.hash = "#/rewards"; true')
  await evaluate('location.reload(); true')
  await sleep(1600)
  const cooled = await evaluate(`[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Claim 500 VC')`)
  check('refill respects the cooldown after a claim', cooled === false)

  const errs = JSON.parse((await evaluate('JSON.stringify(window.__errs || [])')) || '[]')
  check('no console errors during refill flow', errs.length === 0)
})

console.log(`\n${failures === 0 ? 'ALL REFILL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`)
process.exit(failures === 0 ? 0 : 1)
