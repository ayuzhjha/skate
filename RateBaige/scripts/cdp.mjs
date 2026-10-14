/**
 * Tiny Chrome DevTools Protocol helper (no dependencies).
 * Node 24 ships fetch + WebSocket, which is all we need.
 */
import { spawn } from 'node:child_process'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
]

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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
    }
  })

  return {
    ready,
    send(method, params = {}) {
      const id = nextId++
      ws.send(JSON.stringify({ id, method, params }))
      return new Promise((ok, fail) => pending.set(id, { resolve: ok, reject: fail, method }))
    },
    close: () => ws.close(),
  }
}

/**
 * Opens `url` in headless Chrome at an exact viewport, waits for webfonts,
 * then hands a client to `fn`. Always tears the browser down afterwards.
 */
export async function withPage(url, { width = 1440, height = 1000 } = {}, fn) {
  const chromePath = await findChrome()
  const profile = join(tmpdir(), `vanta-${Date.now()}-${Math.floor(Math.random() * 1e5)}`)
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

  const targetWs = async () => {
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

  let client
  try {
    client = connect(await targetWs())
    await client.ready
    await client.send('Page.enable')
    await client.send('Runtime.enable')

    const evaluate = async (expression) => {
      const r = await client.send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
      })
      return r.result?.value
    }

    for (let i = 0; i < 60; i++) {
      if ((await evaluate('document.readyState')) === 'complete') break
      await sleep(150)
    }

    await client.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    })

    await evaluate('document.fonts.ready.then(() => document.fonts.size)')
    await sleep(400)

    return await fn(client, evaluate)
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
}
