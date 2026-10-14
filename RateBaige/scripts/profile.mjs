/**
 * Profile identity test: editing the display name + avatar through the modal
 * updates the profile and persists across a reload.
 *
 * Usage: node scripts/profile.mjs [baseUrl]
 */
import { withPage, sleep } from './cdp.mjs'

const base = process.argv[2] ?? 'http://localhost:5199/'
let failures = 0
const check = (label, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`)
  if (!ok) failures++
}

await withPage(base, { width: 1440, height: 1000 }, async (_c, evaluate) => {
  const clickText = (text) =>
    evaluate(`(() => {
      const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === ${JSON.stringify(text)});
      if (!b) return 'missing'; if (b.disabled) return 'disabled'; b.click(); return 'ok';
    })()`)

  await evaluate('localStorage.clear(); true')
  await evaluate('location.hash = "#/profile"; true')
  await evaluate('location.reload(); true')
  await sleep(1600)

  const startName = await evaluate(`(document.querySelector('.profile-card .title-lg')||{}).textContent`)
  check('profile shows a starting name', !!startName, `name=${startName}`)

  const opened = await clickText('Edit')
  await sleep(400)
  check('edit modal opens', opened === 'ok' && (await evaluate(`!!document.querySelector('.modal .field__input')`)))

  await evaluate(`(() => {
    const input = document.querySelector('.modal .field__input');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'Ace Tester');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`)
  await sleep(200)

  const pickedAvatar = await evaluate(`(() => {
    const b = document.querySelector('.avatar-picker__item[aria-label="Fox"]');
    if (!b) return 'missing'; b.click(); return 'ok';
  })()`)
  check('avatar option selectable', pickedAvatar === 'ok', pickedAvatar)

  const saved = await clickText('Save')
  await sleep(500)
  const newName = await evaluate(`(document.querySelector('.profile-card .title-lg')||{}).textContent`)
  check('saving updates the displayed name', saved === 'ok' && newName === 'Ace Tester', `name=${newName}`)

  await evaluate('location.reload(); true')
  await sleep(1600)
  const persistedName = await evaluate(`(document.querySelector('.profile-card .title-lg')||{}).textContent`)
  check('edited identity persists across reload', persistedName === 'Ace Tester', `name=${persistedName}`)

  const persistedAvatar = await evaluate(`(() => {
    const raw = localStorage.getItem('vanta.state.v1');
    if (!raw) return 'no-store';
    return JSON.parse(raw).player?.avatar ?? 'none';
  })()`)
  check('chosen avatar persisted', persistedAvatar === 'fox', `avatar=${persistedAvatar}`)

  const errs = JSON.parse((await evaluate('JSON.stringify(window.__errs || [])')) || '[]')
  check('no console errors during profile edit', errs.length === 0)
})

console.log(`\n${failures === 0 ? 'ALL PROFILE CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`)
process.exit(failures === 0 ? 0 : 1)
