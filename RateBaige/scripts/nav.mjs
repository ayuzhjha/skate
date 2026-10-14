/**
 * Bottom-nav routing test: verifies each tab navigates and that nested routes
 * light up the right tab (blackjack/history/stats -> Play, credits -> Rewards,
 * settings/help/legal -> Profile).
 *
 * Usage: node scripts/nav.mjs [baseUrl]
 */
import { withPage, sleep } from './cdp.mjs'

const base = process.argv[2] ?? 'http://localhost:5199/'
let failures = 0
const check = (label, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`)
  if (!ok) failures++
}

await withPage(base, { width: 390, height: 844 }, async (_c, evaluate) => {
  // Wait for the app shell (bottom nav) to mount before interacting.
  for (let i = 0; i < 60; i++) {
    const n = await evaluate(`document.querySelectorAll('.tabbar__item').length`)
    if (n >= 4) break
    await sleep(150)
  }

  const activeTab = () =>
    evaluate(
      `(document.querySelector('.tabbar__item.is-active .tabbar__label') || {}).textContent || null`,
    )

  const clickTab = (label) =>
    evaluate(`(() => {
      const item = [...document.querySelectorAll('.tabbar__item')].find(x => x.textContent.trim() === ${JSON.stringify(label)});
      if (!item) return 'missing';
      item.click();
      return 'ok';
    })()`)

  // Primary tabs
  for (const [label, hash] of [
    ['Play', '#/play'],
    ['Rewards', '#/rewards'],
    ['Profile', '#/profile'],
    ['Home', '#/'],
  ]) {
    const r = await clickTab(label)
    await sleep(450)
    const h = await evaluate('location.hash')
    const active = await activeTab()
    check(`tab "${label}" navigates`, r === 'ok' && h === hash, `hash=${h}`)
    check(`tab "${label}" is marked active`, active === label, `active=${active}`)
  }

  // Nested routes light up the owning tab
  for (const [hash, expected, note] of [
    ['#/blackjack', 'Play', 'game'],
    ['#/history', 'Play', 'history'],
    ['#/stats', 'Play', 'stats'],
    ['#/credits', 'Rewards', 'credits'],
    ['#/settings', 'Profile', 'settings'],
    ['#/how-to-play', 'Profile', 'help'],
    ['#/faq', 'Profile', 'faq'],
    ['#/privacy', 'Profile', 'privacy'],
    ['#/terms', 'Profile', 'terms'],
  ]) {
    await evaluate(`location.hash = ${JSON.stringify(hash)}; true`)
    await sleep(450)
    const active = await activeTab()
    check(`${hash} highlights "${expected}"`, active === expected, `active=${active} (${note})`)
  }

  const errs = JSON.parse((await evaluate('JSON.stringify(window.__errs || [])')) || '[]')
  check('no console errors during navigation', errs.length === 0)
})

console.log(`\n${failures === 0 ? 'ALL NAV CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`)
process.exit(failures === 0 ? 0 : 1)
