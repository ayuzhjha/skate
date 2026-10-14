/**
 * Print a compact human-readable summary of a probe JSON file.
 *
 * Usage: node scripts/summary.mjs out/probe-lobby.json
 */
import { readFileSync } from 'node:fs'

const file = process.argv[2]
const j = JSON.parse(readFileSync(file, 'utf8'))

console.log('PAGE   ', JSON.stringify(j.page))
console.log('SVG    ', JSON.stringify(j.svg))
console.log('BANNED ', JSON.stringify(j.bannedHits))
console.log('ISSUES ', JSON.stringify(j.issues))
console.log('COLORS ')
for (const [k, v] of Object.entries(j.colors)) console.log('  ', k.padEnd(12), v)
console.log('ELS')
for (const e of j.els) {
  console.log(
    '  ',
    e.name.padEnd(15),
    'x=' + String(e.x).padStart(4),
    'y=' + String(e.y).padStart(4),
    'w=' + String(e.w).padStart(4),
    'h=' + String(e.h).padStart(4),
    'b=' + String(e.bottom).padStart(4),
  )
}
console.log('FONTS')
for (const f of j.fonts) {
  console.log('  ', f.lines + 'L', String(f.w).padStart(4), String(f.cls).slice(0, 24).padEnd(24), JSON.stringify(f.text))
}
