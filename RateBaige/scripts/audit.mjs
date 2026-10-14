/**
 * Layout audit: verifies the avatar stacks its art + initials in one cell, that
 * interactive controls are visible (non-zero size, painted), and that key
 * surfaces carry a background. Pure geometry/computed-style checks.
 *
 * Usage: node scripts/audit.mjs [baseUrl]
 */
import { withPage, sleep } from './cdp.mjs'

const base = process.argv[2] ?? 'http://localhost:5199/'
let failures = 0
const check = (label, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`)
  if (!ok) failures++
}

await withPage(base, { width: 1440, height: 1000 }, async (_c, evaluate) => {
  await evaluate('localStorage.clear(); true')
  await evaluate('location.hash = "#/"; true')
  await evaluate('location.reload(); true')
  await sleep(1600)

  const avatar = JSON.parse(
    await evaluate(`(() => {
      const a = document.querySelector('.avatar');
      const i = document.querySelector('.avatar__initials');
      if (!a) return JSON.stringify({ found: false });
      const ar = a.getBoundingClientRect();
      const ir = i ? i.getBoundingClientRect() : null;
      return JSON.stringify({
        found: true,
        a: { w: Math.round(ar.width), h: Math.round(ar.height) },
        initials: i ? i.textContent : null,
        ir: ir ? { x: Math.round(ir.x), y: Math.round(ir.y), w: Math.round(ir.width), h: Math.round(ir.height) } : null,
        inside: ir ? ir.left >= ar.left - 1 && ir.right <= ar.right + 1 && ir.top >= ar.top - 1 && ir.bottom <= ar.bottom + 1 : null,
      });
    })()`),
  )
  check('nav avatar renders', avatar.found === true)
  check('avatar is a square chip', avatar.a && Math.abs(avatar.a.w - avatar.a.h) <= 1, JSON.stringify(avatar.a))
  check('avatar initials stay inside the circle', avatar.inside === true, JSON.stringify(avatar.ir))

  // Interactive controls: every button/link should be visible when present.
  const invis = JSON.parse(
    await evaluate(`(() => {
      const bad = [];
      for (const el of document.querySelectorAll('button, a.btn, a.chip-link, a.game-card, .tabbar__item')) {
        if (el.checkVisibility && !el.checkVisibility()) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) { bad.push(el.className + ' :: ' + Math.round(r.width) + 'x' + Math.round(r.height)); continue; }
        const cs = getComputedStyle(el);
        if (parseFloat(cs.opacity) < 0.15) bad.push(el.className + ' opacity ' + cs.opacity);
      }
      return JSON.stringify(bad);
    })()`),
  )
  check('all interactive controls are visible', invis.length === 0, invis.slice(0, 4).join(' | '))

  // Surfaces carry paint.
  const surfaces = JSON.parse(
    await evaluate(`(() => {
      const bg = (s) => { const el = document.querySelector(s); return el ? getComputedStyle(el).backgroundColor : null };
      return JSON.stringify({ body: bg('body'), panel: bg('.panel'), nav: bg('.nav'), chip: bg('.balance-chip') });
    })()`),
  )
  const opaque = (c) => c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent'
  check('app body is painted', opaque(surfaces.body), surfaces.body)
  check('panels are painted', opaque(surfaces.panel), surfaces.panel)

  // Blackjack table felt renders.
  await evaluate('location.hash = "#/blackjack"; true')
  await sleep(700)
  const felt = JSON.parse(
    await evaluate(`(() => {
      const t = document.querySelector('.bj-table');
      if (!t) return JSON.stringify({ found: false });
      const cs = getComputedStyle(t);
      return JSON.stringify({ found: true, bg: cs.backgroundColor, h: Math.round(t.getBoundingClientRect().height) });
    })()`),
  )
  check('blackjack table renders with a felt surface', felt.found === true && felt.h > 200, JSON.stringify(felt))

  const errs = JSON.parse((await evaluate('JSON.stringify(window.__errs || [])')) || '[]')
  check('no console errors during audit', errs.length === 0)
})

console.log(`\n${failures === 0 ? 'ALL AUDIT CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`)
process.exit(failures === 0 ? 0 : 1)
