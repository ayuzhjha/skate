/**
 * Route smoke test: walks every hash route, records render text length and
 * any console errors / runtime exceptions triggered along the way.
 *
 * Usage: node scripts/smoke.mjs [baseUrl]
 */
import { withPage, sleep } from './cdp.mjs'

const base = process.argv[2] ?? 'http://localhost:5199/'
const WIDTH = Number(process.argv[3] ?? 1440)
const HEIGHT = Number(process.argv[4] ?? 1000)

const ROUTES = [
  '#/',
  '#/play',
  '#/rewards',
  '#/profile',
  '#/credits',
  '#/history',
  '#/stats',
  '#/blackjack',
  '#/settings',
  '#/how-to-play',
  '#/faq',
  '#/privacy',
  '#/terms',
]

await withPage(base, { width: WIDTH, height: HEIGHT }, async (_client, evaluate) => {
  await evaluate(`
    window.__errs = [];
    window.addEventListener('error', (e) => window.__errs.push('error: ' + (e.message || e)));
    window.addEventListener('unhandledrejection', (e) => window.__errs.push('rejection: ' + (e.reason && e.reason.message || e.reason)));
    const oe = console.error;
    console.error = (...a) => { window.__errs.push('console.error: ' + a.map(x => (x && x.message) || String(x)).join(' ')); oe.apply(console, a); };
    true
  `)

  for (const route of ROUTES) {
    await evaluate(`location.hash = ${JSON.stringify(route)}; true`)
    await sleep(650)
    const info = await evaluate(
      `(() => {
        const screen = document.querySelector('.screen');
        const tabbar = document.querySelector('.tabbar');
        const nav = document.querySelector('.nav');
        const h = (el) => el ? Math.round(el.getBoundingClientRect().height) : 0;
        return JSON.stringify({
          hash: location.hash,
          screen: !!screen,
          nav: h(nav),
          tabbar: tabbar ? getComputedStyle(tabbar).display : 'none',
          chars: (document.body.innerText || '').trim().length,
          overflowX: document.documentElement.scrollWidth - window.innerWidth,
          title: (document.querySelector('h1, .title-xl, .title-lg, .prose h2') || {}).textContent || '',
        });
      })()`,
    )
    console.log(route.padEnd(16), info)
  }

  const errs = await evaluate('JSON.stringify(window.__errs)')
  const parsed = JSON.parse(errs || '[]')
  console.log('\nERRORS:', parsed.length)
  for (const e of parsed) console.log('  -', e)
})
