/**
 * Minimal zero-dependency Chrome DevTools Protocol renderer.
 *
 * Usage:
 *   node scripts/render.mjs <url> <out.png> [width] [height] [fullPage]
 *
 * Gives an exact device-metrics viewport (default 1440x1000 at DPR 1),
 * waits for webfonts, prints measured layout heights, then captures a PNG.
 */
import { spawn } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
]

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const [url, outArg, wArg, hArg, fullArg] = process.argv.slice(2)
const width = Number(wArg ?? 1440)
const height = Number(hArg ?? 1000)
const fullPage = fullArg === 'true'
const out = resolve(root, outArg ?? 'out/shot.png')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function findChrome() {
  const { access } = await import('node:fs/promises')
  for (const p of CHROME_CANDIDATES) {
    try {
      await access(p)
      return p
    } catch {
      /* keep looking */
    }
  }
  throw new Error('No Chrome/Edge binary found')
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl)
  let nextId = 1
  const pending = new Map()
  const listeners = new Set()

  const ready = new Promise((res, rej) => {
    ws.addEventListener('open', () => res())
    ws.addEventListener('error', (e) => rej(new Error(String(e?.message ?? e))))
  })

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve: ok, reject: fail, method } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) fail(new Error(`${method}: ${msg.error.message}`))
      else ok(msg.result)
    } else if (msg.method) {
      for (const fn of listeners) fn(msg)
    }
  })

  return {
    ready,
    send(method, params = {}) {
      const id = nextId++
      ws.send(JSON.stringify({ id, method, params }))
      return new Promise((ok, fail) => pending.set(id, { resolve: ok, reject: fail, method }))
    },
    once(method, timeoutMs = 20000) {
      return new Promise((ok, fail) => {
        const t = setTimeout(() => fail(new Error(`timeout waiting for ${method}`)), timeoutMs)
        const fn = (msg) => {
          if (msg.method !== method) return
          clearTimeout(t)
          listeners.delete(fn)
          ok(msg.params)
        }
        listeners.add(fn)
      })
    },
    close: () => ws.close(),
  }
}

const chromePath = await findChrome()
const profile = join(tmpdir(), `vanta-shot-${Date.now()}`)
const port = 9300 + Math.floor(Math.random() * 400)

const chrome = spawn(
  chromePath,
  [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--force-color-profile=srgb',
    '--font-render-hinting=none',
    '--disable-lcd-text',
    `--window-size=${width},${height}`,
    url,
  ],
  { stdio: 'ignore' },
)

async function targetWs() {
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`)
      const list = await res.json()
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)
      if (page) return page.webSocketDebuggerUrl
    } catch {
      /* not up yet */
    }
    await sleep(150)
  }
  throw new Error('Chrome did not expose a page target')
}

const evalValue = async (client, expression) => {
  const r = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  return r.result?.value
}

let client
try {
  client = connect(await targetWs())
  await client.ready
  await client.send('Page.enable')
  await client.send('Runtime.enable')

  // Wait for the very first paint of the app.
  for (let i = 0; i < 60; i++) {
    const state = await evalValue(client, 'document.readyState')
    if (state === 'complete') break
    await sleep(150)
  }

  await client.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  })

  await evalValue(client, 'document.fonts.ready.then(() => document.fonts.size)')
  await sleep(400)

  const metricsJson = await evalValue(
    client,
    `(() => {
      const q = (s) => document.querySelector(s)
      const h = (s) => { const el = q(s); return el ? Math.round(el.getBoundingClientRect().height) : null }
      return JSON.stringify({
        scrollHeight: document.documentElement.scrollHeight,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        nav: h('.nav'),
        main: h('main'),
        footer: h('.footer'),
        grid: h('.page__grid') ?? h('.credits__grid'),
        feature: h('.feature'),
        games: h('.games'),
        daily: h('.daily'),
        activity: h('.activity'),
        ledger: h('.ledger'),
        pagehead: h('.pagehead'),
        leftStack: h('.stack'),
        overflow: document.documentElement.scrollHeight - window.innerHeight,
      })
    })()`,
  )
  console.log('metrics', metricsJson)

  const scrollHeight = JSON.parse(metricsJson).scrollHeight
  const shot = await client.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: {
      x: 0,
      y: 0,
      width,
      height: fullPage ? Math.max(height, scrollHeight) : height,
      scale: 1,
    },
  })

  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, Buffer.from(shot.data, 'base64'))
  console.log('wrote', out)
} finally {
  try {
    client?.close()
  } catch {
    /* ignore */
  }
  chrome.kill()
  await sleep(250)
  await rm(profile, { recursive: true, force: true }).catch(() => {})
}
