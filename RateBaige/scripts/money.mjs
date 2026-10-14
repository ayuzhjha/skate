/**
 * Real-money language audit: walks every route and flags any visible text that
 * implies deposits, withdrawals, purchases, cash-outs or real currency. Also
 * asserts the disclaimers that SHOULD be present.
 *
 * Usage: node scripts/money.mjs [baseUrl]
 */
import { withPage, sleep } from './cdp.mjs'

const base = process.argv[2] ?? 'http://localhost:5199/'
const ROUTES = [
  '#/', '#/play', '#/rewards', '#/profile', '#/credits', '#/history',
  '#/stats', '#/blackjack', '#/settings', '#/how-to-play', '#/faq',
  '#/privacy', '#/terms',
]

// Words that must never appear as an offered action.
const BANNED = /\b(deposit|withdraw|withdrawal|cash ?out|purchase|buy now|checkout|payment method|credit card|debit card|crypto|bitcoin|real money|usd|eur|gbp|exchange rate|redeem|prize|cash ?prize)\b/i
const CURRENCY = /\$\s?\d|\d\s?(usd|eur|gbp|dollars?)/i

let failures = 0
const check = (label, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`)
  if (!ok) failures++
}

await withPage(base, { width: 1440, height: 1000 }, async (_c, evaluate) => {
  let allHits = []
  let sawVirtual = false
  let sawNotRedeem = false

  for (const route of ROUTES) {
    await evaluate(`location.hash = ${JSON.stringify(route)}; true`)
    await sleep(550)
    const leaves = JSON.parse(
      await evaluate(`JSON.stringify(
        [...document.querySelectorAll('body *')]
          .filter((el) => !el.children.length)
          .map((el) => el.textContent.trim())
          .filter(Boolean)
      )`),
    )
    // A mention is only a real-money "offer" if it is not negated and not a question.
    const SAFE = /\b(no|not|nothing|never|doesn'?t|does not|cannot|can'?t|without|free)\b/i
    for (const t of leaves) {
      if (BANNED.test(t) || CURRENCY.test(t)) {
        const negated = SAFE.test(t) || t.trim().endsWith('?')
        if (!negated) allHits.push(`${route}: ${t.slice(0, 70)}`)
      }
      if (/virtual/i.test(t)) sawVirtual = true
      if (/not? (be )?(redeemable|cashable|exchangeable)|no real|not real money|non-?redeemable/i.test(t)) sawNotRedeem = true
    }
  }

  check('no real-money offers or currency appear anywhere', allHits.length === 0, allHits.slice(0, 6).join(' | '))
  check('the app describes credits as virtual', sawVirtual)
  check('the app states credits are not redeemable', sawNotRedeem)
})

console.log(`\n${failures === 0 ? 'ALL MONEY-LANGUAGE CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`)
process.exit(failures === 0 ? 0 : 1)
