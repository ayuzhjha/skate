/**
 * Settings test: theme + motion preferences apply to <html> and persist,
 * toggles work, and the destructive reset requires confirmation and restores
 * a fresh guest account.
 *
 * Usage: node scripts/settings.mjs [baseUrl]
 */
import { withPage, sleep } from './cdp.mjs'

const base = process.argv[2] ?? 'http://localhost:5199/'
let failures = 0
const check = (label, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`)
  if (!ok) failures++
}

await withPage(base, { width: 1440, height: 1000 }, async (_c, evaluate) => {
  const clickText = (text, exact = false) =>
    evaluate(`(() => {
      const b = [...document.querySelectorAll('button')].find(x =>
        ${exact ? `${JSON.stringify(text)} === x.textContent.trim()` : `x.textContent.includes(${JSON.stringify(text)})`});
      if (!b) return 'missing';
      if (b.disabled) return 'disabled';
      b.click();
      return 'ok';
    })()`)

  const dataset = async () =>
    JSON.parse(await evaluate(`JSON.stringify({ ...document.documentElement.dataset })`))

  await evaluate('localStorage.clear(); true')
  await evaluate('location.hash = "#/settings"; true')
  await evaluate('location.reload(); true')
  await sleep(1600)
  for (let i = 0; i < 40; i++) {
    if ((await evaluate(`document.querySelectorAll('.theme-swatch').length`)) >= 3) break
    await sleep(150)
  }

  let d = await dataset()
  check('default theme is obsidian on <html>', d.theme === 'obsidian', JSON.stringify(d))

  const obsidianGold = await evaluate(
    `getComputedStyle(document.documentElement).getPropertyValue('--gold').trim()`,
  )

  // Theme switch
  const themeClick = await clickText('Jade')
  await sleep(400)
  d = await dataset()
  check('selecting Jade applies data-theme="jade"', themeClick === 'ok' && d.theme === 'jade', `theme=${d.theme}`)
  const jadeGold = await evaluate(
    `getComputedStyle(document.documentElement).getPropertyValue('--gold').trim()`,
  )
  check('theme switch changes the accent token', obsidianGold !== jadeGold && jadeGold === '#a7c298', `${obsidianGold} -> ${jadeGold}`)

  // Motion switch
  const motionClick = await clickText('Reduced', true)
  await sleep(400)
  d = await dataset()
  check('selecting Reduced applies data-motion="reduced"', motionClick === 'ok' && d.motion === 'reduced', `motion=${d.motion}`)

  // Sound toggle
  const soundBefore = await evaluate(`document.querySelector('button.toggle-row')?.getAttribute('aria-checked')`)
  const soundClick = await clickText('Sound effects')
  await sleep(300)
  const soundAfter = await evaluate(`document.querySelector('button.toggle-row')?.getAttribute('aria-checked')`)
  check('sound toggle flips aria-checked', soundClick === 'ok' && soundBefore !== soundAfter, `${soundBefore} -> ${soundAfter}`)

  // Persistence across reload
  await evaluate('location.reload(); true')
  await sleep(1600)
  d = await dataset()
  check('theme persists across reload', d.theme === 'jade', `theme=${d.theme}`)
  check('motion persists across reload', d.motion === 'reduced', `motion=${d.motion}`)

  // Reset requires confirmation and restores the guest account
  await evaluate('location.hash = "#/settings"; true')
  await sleep(600)
  const openReset = await clickText('Reset progress')
  await sleep(400)
  const modalOpen = await evaluate(`!!document.querySelector('.modal')`)
  check('reset opens a confirmation dialog', openReset === 'ok' && modalOpen === true)

  const cancel = await clickText('Keep my progress')
  await sleep(300)
  check('confirmation can be cancelled', cancel === 'ok' && !(await evaluate(`!!document.querySelector('.modal')`)))

  await clickText('Reset progress')
  await sleep(300)
  const confirmReset = await clickText('Reset everything')
  await sleep(700)
  const after = JSON.parse(
    await evaluate(
      `JSON.stringify({ hash: location.hash, theme: document.documentElement.dataset.theme, bal: (document.querySelector('.balance-chip__value')||{}).textContent })`,
    ),
  )
  check('reset returns to home with a fresh balance', after.hash === '#/' && /2,?500/.test(after.bal || ''), JSON.stringify(after))

  const errs = JSON.parse((await evaluate('JSON.stringify(window.__errs || [])')) || '[]')
  check('no console errors during settings flow', errs.length === 0)
})

console.log(`\n${failures === 0 ? 'ALL SETTINGS CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`)
process.exit(failures === 0 ? 0 : 1)
