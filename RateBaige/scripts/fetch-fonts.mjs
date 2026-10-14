import { mkdir, writeFile, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'fonts')

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const cssUrl =
  'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300..700&family=Inter:wght@300..700&display=swap'

const res = await fetch(cssUrl, { headers: { 'User-Agent': UA } })
const css = await res.text()

// Blocks that carry the basic-latin range (U+0000-00FF) are the ones we want.
const wanted = css
  .split('@font-face')
  .slice(1)
  .map((block) => ({
    family: /font-family:\s*'([^']+)'/.exec(block)?.[1],
    weight: /font-weight:\s*([0-9]+\s+[0-9]+|[0-9]+)/.exec(block)?.[1],
    style: /font-style:\s*([a-z]+)/.exec(block)?.[1],
    url: /url\((https:[^)]+\.woff2)\)/.exec(block)?.[1],
    range: /unicode-range:\s*([^;]+);/.exec(block)?.[1] ?? '',
  }))
  .filter((f) => f.family && f.url && f.range.includes('U+0000-00FF'))

await rm(outDir, { recursive: true, force: true })
await mkdir(outDir, { recursive: true })

const out = []
for (const face of wanted) {
  const name = `${face.family.toLowerCase()}.woff2`
  const bin = await fetch(face.url, { headers: { 'User-Agent': UA } })
  const buf = Buffer.from(await bin.arrayBuffer())
  await writeFile(join(outDir, name), buf)
  out.push({ ...face, name, bytes: buf.length })
}

await writeFile(
  join(root, 'scripts', 'fonts.manifest.json'),
  JSON.stringify(out, null, 2),
)
console.log(out.map((f) => `${f.name} w=${f.weight} ${f.bytes}B`).join('\n'))
