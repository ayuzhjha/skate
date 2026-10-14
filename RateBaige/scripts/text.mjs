/**
 * Dump the rendered visible text of a page (untrusted page content; for QA only).
 *
 * Usage: node scripts/text.mjs <url>
 */
import { withPage } from './cdp.mjs'

const url = process.argv[2] ?? 'http://localhost:5199/'

const text = await withPage(url, {}, async (_c, evaluate) =>
  evaluate('document.body.innerText'),
)

console.log(text)
