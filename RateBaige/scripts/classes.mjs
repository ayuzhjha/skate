/**
 * CSS coverage audit: lists class names referenced in TSX that have no matching
 * rule in the stylesheet. Catches components that would render unstyled.
 *
 * Usage: node scripts/classes.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const SRC = 'src'

const files = []
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p)
    else files.push(p)
  }
}
walk(SRC)

const tsx = files.filter((f) => extname(f) === '.tsx')
const css = files.filter((f) => extname(f) === '.css')

// --- collect class names defined in CSS ---
const defined = new Set()
for (const f of css) {
  const text = readFileSync(f, 'utf8')
  for (const m of text.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) defined.add(m[1])
}

// --- collect class names used in TSX ---
const used = new Map() // class -> file
for (const f of tsx) {
  const text = readFileSync(f, 'utf8')
  // static className="a b c"
  for (const m of text.matchAll(/className="([^"]+)"/g)) {
    for (const c of m[1].split(/\s+/)) if (c) used.set(c, f)
  }
  // className={`...`}  -> pull word tokens
  for (const m of text.matchAll(/className=\{`([^`]+)`\}/g)) {
    for (const c of m[1].split(/[\s${}?:'"`]+/)) {
      if (/^[a-z][\w-]*$/.test(c) && c.length > 1) used.set(c, f)
    }
  }
  // className={`a${x ? ' b' : ''}`} style ternaries: 'is-x', 'btn--y'
  for (const m of text.matchAll(/'([a-z][\w-]*(?:--[\w-]+)?)(?:\s+[a-z][\w-]*(?:--[\w-]+)?)*'/g)) {
    for (const c of m[1].split(/\s+/)) if (/^[a-z]/.test(c)) used.set(c, f)
  }
}

const missing = [...used.entries()].filter(([c]) => !defined.has(c)).sort()

console.log(`classes defined in CSS: ${defined.size}`)
console.log(`classes referenced in TSX: ${used.size}`)
console.log(`\nreferenced but NOT defined in CSS (${missing.length}):`)
for (const [c, f] of missing) console.log(`  .${c}   (${f})`)
