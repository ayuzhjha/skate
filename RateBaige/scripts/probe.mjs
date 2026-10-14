/**
 * Inspect the rendered geometry of a page without looking at pixels.
 *
 * Usage: node scripts/probe.mjs <url>
 */
import { withPage } from './cdp.mjs'

const url = process.argv[2] ?? 'http://localhost:5199/'

const PROBE = `(() => {
  const out = { page: {}, els: [], fonts: [], issues: [] }

  out.page = {
    scrollHeight: document.documentElement.scrollHeight,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    overflowY: document.documentElement.scrollHeight - window.innerHeight,
    overflowX: document.documentElement.scrollWidth - window.innerWidth,
  }

  const sel = [
    ['.shell', 'shell'],
    ['.nav__inner', 'nav-inner'],
    ['.brand', 'brand'],
    ['.nav__links', 'nav-links'],
    ['.nav__right', 'nav-right'],
    ['.page__grid', 'grid'],
    ['.credits__grid', 'grid'],
    ['.page__headline', 'h1'],
    ['.hero__note', 'hero-note'],
    ['.feature', 'feature'],
    ['.feature__body', 'feature-body'],
    ['.feature__art', 'feature-art'],
    ['.feature__desc', 'feature-desc'],
    ['.games', 'games'],
    ['.games-grid', 'games-grid'],
    ['.game-card', 'game-card-1'],
    ['.daily', 'daily'],
    ['.activity', 'activity'],
    ['.ledger', 'ledger'],
    ['.ledger__cols', 'ledger-cols'],
    ['.ledger .row', 'ledger-row-1'],
    ['.ledger__foot', 'ledger-foot'],
    ['.pagehead', 'pagehead'],
    ['.pagehead__value', 'balance'],
    ['.pagehead__caption', 'caption'],
    ['.pagehead__stats', 'stats'],
    ['.progress', 'progress'],
    ['.explainer', 'explainer'],
    ['.explainer__item', 'explainer-item-1'],
    ['.footer', 'footer'],
    ['.footer__note', 'footer-note'],
  ]

  for (const [selector, name] of sel) {
    const el = document.querySelector(selector)
    if (!el) continue
    const r = el.getBoundingClientRect()
    out.els.push({
      name,
      x: Math.round(r.x),
      y: Math.round(r.y),
      w: Math.round(r.width),
      h: Math.round(r.height),
      bottom: Math.round(r.bottom),
    })
  }

  // Text that wraps to more lines than expected
  for (const el of document.querySelectorAll('.footer__note, .feature__desc, .explainer__item span:last-child, .game-card__desc, .hero__note, .progress__foot')) {
    const lh = parseFloat(getComputedStyle(el).lineHeight)
    out.fonts.push({
      cls: el.className || el.tagName,
      w: Math.round(el.getBoundingClientRect().width),
      lines: Math.round(el.getBoundingClientRect().height / lh),
      text: el.textContent.slice(0, 42),
    })
  }

  // Anything bleeding past the 1440 viewport or its own box
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) continue
    if (r.right > window.innerWidth + 0.5 || r.left < -0.5) {
      out.issues.push({ kind: 'viewport', tag: el.tagName, cls: el.className, x: Math.round(r.x), right: Math.round(r.right) })
    }
    if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === 'visible') {
      out.issues.push({ kind: 'content', tag: el.tagName, cls: el.className, sw: el.scrollWidth, cw: el.clientWidth })
    }
  }
  out.issues = out.issues.slice(0, 12)

  // Hero illustration geometry
  const art = document.querySelector('.feature__art svg')
  if (art) {
    const bb = art.getBBox()
    const groups = [...art.querySelectorAll('g')]
      .map((g) => {
        const b = g.getBBox()
        return { w: Math.round(b.width), h: Math.round(b.height), x: Math.round(b.x), y: Math.round(b.y), t: g.getAttribute('transform') }
      })
      .filter((g) => g.w > 20)
    out.svg = {
      viewBox: art.getAttribute('viewBox'),
      content: { x: Math.round(bb.x), y: Math.round(bb.y), w: Math.round(bb.width), h: Math.round(bb.height) },
      cx: Math.round(bb.x + bb.width / 2),
      cy: Math.round(bb.y + bb.height / 2),
      groups,
    }
  }

  // Key computed colours
  const cs = (s, prop) => { const el = document.querySelector(s); return el ? getComputedStyle(el)[prop] : null }
  out.colors = {
    body: cs('body', 'backgroundColor'),
    panel: cs('.panel', 'backgroundColor'),
    ledgerCols: cs('.ledger__cols', 'color'),
    rowNote: cs('.row__note', 'color'),
    amount: cs('.row__amount', 'color'),
    footerNote: cs('.footer__note', 'color'),
    dailyFoot: cs('.daily__foot', 'color'),
    featureMeta: cs('.feature__meta', 'color'),
  }

  // Anything with a hard-coded money-ish word
  const banned = /\\b(deposit|withdraw|buy|purchase|crypto|payment)\\b|balance in|\\$|\\bUSD\\b|\\bEUR\\b|exchange rate/i
  const hits = []
  for (const el of document.querySelectorAll('body *')) {
    if (el.children.length) continue
    const t = el.textContent.trim()
    if (t && banned.test(t)) hits.push(t.slice(0, 60))
  }
  out.bannedHits = hits

  return JSON.stringify(out)
})()`

const result = await withPage(url, {}, async (_client, evaluate) =>
  evaluate(PROBE),
)

console.log(JSON.stringify(JSON.parse(result), null, 1))
