// End-to-end test of the built extension in Chromium. Run `npm run build:extension` first, then `node extension/e2e.mjs`.
// It serves the demo sites and the hostile test page on localhost, loads the extension, and drives the side panel
// with the Space and Escape keys only. The panel opens as a normal tab, with the page tab named in its hash.
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { extname, join, normalize } from 'node:path'
import { createRequire } from 'node:module'

const { chromium } = createRequire(import.meta.url)('playwright')
const here = import.meta.dirname
const dist = join(here, 'dist')
if (!existsSync(join(dist, 'manifest.json'))) throw new Error('Run npm run build:extension first.')

// A copy of the build that already holds the localhost permission, because a test cannot click a Chrome prompt.
const ext = mkdtempSync(join(tmpdir(), 'transcendent-ext-'))
cpSync(dist, ext, { recursive: true })
const manifest = JSON.parse(readFileSync(join(ext, 'manifest.json'), 'utf8'))
writeFileSync(join(ext, 'manifest.json'), JSON.stringify({ ...manifest, host_permissions: ['http://localhost/*'] }))

const ROOTS = { 'demo-sites': join(here, '../public/demo-sites'), 'test-pages': join(here, 'test-pages') }
const TYPES = { '.html': 'text/html', '.css': 'text/css' }
const server = createServer((req, res) => {
  const [, dir, ...rest] = new URL(req.url, 'http://x').pathname.split('/')
  const file = ROOTS[dir] && normalize(join(ROOTS[dir], ...rest))
  if (!file || !file.startsWith(ROOTS[dir]) || !existsSync(file)) return res.writeHead(404).end()
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'text/plain' }).end(readFileSync(file))
})
await new Promise((r) => server.listen(0, 'localhost', r))
const base = `http://localhost:${server.address().port}`

const context = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless: true,
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
})
const errors = []
const watch = (p, name) => p.on('pageerror', (e) => errors.push(`${name}: ${e.message}`))
const worker = async () => context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'))
const id = new URL((await worker()).url()).host

let failures = 0
const check = (ok, what) => {
  console.log(`${ok ? 'pass' : 'FAIL'}  ${what}`)
  if (!ok) failures++
}

try {
  const sw = await worker()
  await sw.evaluate(() => chrome.storage.local.set({ settings: { camera: false, stepMs: 600, blink: { threshold: 0.5, holdMs: 500 } } }))
  const site = await context.newPage()
  watch(site, 'page')
  await site.goto(`${base}/demo-sites/mail.html`)
  const tabId = await sw.evaluate(async (url) => (await chrome.tabs.query({ url: `${url}/*` }))[0].id, base)

  const panel = await context.newPage()
  watch(panel, 'panel')
  await panel.goto(`chrome-extension://${id}/sidepanel.html#tab=${tabId}`)
  const host = new URL(base).host
  await panel.getByRole('button', { name: `Turn on ${host}` }).click()
  await panel.locator('[data-item]').first().waitFor()

  const cards = () => panel.locator('[data-item]').allTextContents()
  // Waits for the highlight to reach the card, then presses Space once.
  const choose = async (re) => {
    const all = await cards()
    if (!all.some((t) => re.test(t))) throw new Error(`No card matches ${re}: ${all.join(' | ')}`)
    await panel.waitForFunction(
      ([src, flags]) => new RegExp(src, flags).test(document.querySelector('[data-highlight]')?.textContent ?? ''),
      [re.source, re.flags],
      { timeout: 20000, polling: 50 },
    )
    await panel.keyboard.press('Space')
    await panel.waitForTimeout(400)
  }
  // Chooses from the top cards, or through "Something else" and the group.
  const reach = async (re, group) => {
    if (!(await cards()).some((t) => re.test(t))) {
      await choose(/^Something else$/)
      await choose(new RegExp(`^${group}$`))
    }
    await choose(re)
  }
  const typeWord = async (word) => {
    const rows = [['␣', 'e', 't', 'a', '⌫', '✓'], ['o', 'i', 'n', 's', 'h', 'r'], ['d', 'l', 'c', 'u', 'm', 'w']]
    for (const ch of [...word, '✓']) {
      const row = rows.find((r) => r.includes(ch))
      await choose(new RegExp(`^${row.join(' ')}$`))
      await choose(new RegExp(`^${ch}$`))
    }
  }

  // Mail task: open Maya's message, reply "hi", and send it, with Space only.
  await reach(/^Maya Chen Lunch on Friday\?$/, 'Links and buttons')
  await site.waitForURL(/#m\/m1$/)
  await reach(/^Reply$/, 'Links and buttons')
  await site.waitForURL(/#reply\/m1$/)
  await panel.waitForFunction(() => document.body.textContent.includes('Write in: Reply to Maya Chen'))
  await choose(/^Write in: Reply to Maya Chen$/)
  await typeWord('hi')
  await panel.waitForFunction(() => !document.body.textContent.includes('Write in: Reply to Maya Chen'), null, { timeout: 5000 }).catch(() => {})
  check((await site.inputValue('#reply')) === 'hi', 'the scanning keyboard typed "hi" into the reply field')
  check(!(await cards()).slice(0, 4).includes('Send'), 'Send is not in the top 4, because irreversible actions rank last')
  await reach(/^Send$/, 'Send, buy, or delete')
  const confirm = await cards()
  check(confirm[0] === 'Cancel' && confirm[1] === 'Confirm: Send', 'Send opens a confirm screen with Cancel first')
  check(await site.locator('transcendent-highlight').count() === 1, 'the page shows the highlight overlay')
  check(await site.evaluate(() => document.querySelector('transcendent-highlight').shadowRoot === null), 'the overlay shadow root is closed')
  await choose(/^Confirm: Send$/)
  await site.waitForURL(/#sent$/)
  check(await site.getByText('Re: Lunch on Friday?').isVisible(), 'the mail task completed end to end: the reply is in Sent')
  const log = (await (await worker()).evaluate(() => chrome.storage.local.get('log'))).log
  check(log.length === 4 && log.at(-1).label === 'Send' && log.at(-1).risk === 'irreversible' && log.at(-1).site === base,
    'the log holds each executed action with its origin and risk')

  // Escape on the page stops the scan and removes the overlay.
  await site.bringToFront()
  await site.keyboard.press('Escape')
  await panel.waitForFunction(() => document.body.textContent.includes('Paused. Select to start again'))
  check(await site.locator('transcendent-highlight').count() === 0, 'Escape on the page stops the scan and removes the overlay')
  await panel.bringToFront()
  await panel.keyboard.press('Space')
  await panel.waitForFunction(() => document.body.textContent.includes('Next action'))
  check(true, 'one select starts the scan again')

  // The checkout page: the panel says payments are refused and lists no form actions.
  await site.goto(`${base}/demo-sites/checkout.html`)
  await panel.waitForFunction(() => document.body.textContent.includes('card details'))
  await panel.waitForTimeout(500)
  const payCards = await cards()
  check(!payCards.some((t) => /Place order|Write in/.test(t)), 'the panel shows only scroll and move actions on the card page')

  // The hostile page through the panel: labels with HTML stay text.
  await site.goto(`${base}/test-pages/hostile.html`)
  await panel.waitForFunction(() => document.body.textContent.includes('Next action'))
  await panel.waitForTimeout(500)
  await choose(/^Something else$/)
  await choose(/^Send, buy, or delete$/)
  const risky = await cards()
  check(risky.includes('Cancel (page names it: Send)'), 'the fake safe button is in the irreversible group, and its label shows the page name')
  await choose(/^Back$/)
  await choose(/^Links and buttons$/)
  const safe = await cards()
  check(safe.some((t) => t.startsWith('<img src=x')), 'a label with HTML shows as plain text')
  check(await panel.evaluate(() => !document.querySelector('[data-item] img, [data-item] b') && !window.pwned), 'no page HTML or script ran in the panel')
  check(await site.evaluate(() => !window.pwned && !window.sent), 'no page script ran and nothing was sent on the hostile page')
  // The model setting is off by default, so Tier 0 ranked every list above.
  await panel.getByRole('button', { name: 'Settings' }).click()
  check(!(await panel.getByLabel(/^Rank with the on-device model/).isChecked()), 'the on-device model setting exists and is off by default')
  await panel.close()

  // Without the panel, the test reads and runs through its own connection to the content script.
  const talk = async (messages) =>
    (await worker()).evaluate(
      async ([tab, list]) => {
        await chrome.scripting.executeScript({ target: { tabId: tab }, files: ['content.js'] })
        const port = chrome.tabs.connect(tab, { name: 'transcendent' })
        const replies = []
        await new Promise((resolve) => {
          port.onMessage.addListener((m) => {
            if (m.type === 'key') return
            replies.push(m)
            if (replies.length === list.length) resolve()
          })
          list.forEach((m) => port.postMessage(m))
        })
        port.disconnect()
        return replies
      },
      [tabId, messages],
    )
  const read = async () => (await talk([{ type: 'read' }]))[0].state

  const hostile = await read()
  const labels = hostile.actions.map((a) => a.label)
  check(!labels.some((l) => /hidden/.test(l)), 'hidden, faint, offscreen, tiny, covered, aria-hidden, inert, and disabled buttons are not listed')
  const fake = hostile.actions.filter((a) => /^Cancel/.test(a.label))
  check(fake.length === 2 && fake.every((a) => a.risk === 'irreversible'), 'both fake Cancel buttons (aria-label Send, value Send) are irreversible')
  const inject = hostile.actions.find((a) => a.label.startsWith('Next'))
  check(inject?.risk === 'irreversible' && /page names it/.test(inject.label), 'the injected aria-label shows in the label and makes the button irreversible')
  check(hostile.actions.find((a) => a.label === 'Change photo')?.risk === 'safe', 'a plain button stays safe')
  check(hostile.description.startsWith('The web page "Account settings": Account settings') && !hostile.description.includes('Send hidden 8'),
    'the page description holds the title and the visible text only')
  const [unconfirmed] = await talk([{ type: 'run', id: fake[0].id, label: fake[0].label, confirmed: false }])
  check(unconfirmed.error !== '' && !(await site.evaluate(() => window.sent)), 'the executor refuses an irreversible action that was not confirmed')

  await site.goto(`${base}/demo-sites/shop.html#product/p1`)
  const product = await read()
  await talk([{ type: 'run', ...pickRun(product, 'Add to cart') }, { type: 'read' }])
  await site.goto(`${base}/demo-sites/shop.html#cart`)
  const cart = await read()
  check(cart.actions.find((a) => a.label === 'Checkout')?.risk === 'irreversible', 'the shop Checkout link is irreversible')
  check(cart.actions.find((a) => a.label.startsWith('Remove'))?.risk === 'irreversible', 'the shop Remove button is irreversible')

  await site.goto(`${base}/demo-sites/checkout.html`)
  const pay = await read()
  check(pay.payments, 'the checkout page is detected as a card page')
  const order = pay.actions.find((a) => a.label === 'Place order')
  const field = pay.actions.find((a) => a.kind === 'type')
  const runs = await talk([
    { type: 'run', id: order.id, label: order.label, confirmed: true },
    { type: 'run', id: field.id, label: field.label, confirmed: false, text: '4242' },
    { type: 'run', id: 'scroll-down', label: 'Scroll down one screen', confirmed: false },
  ])
  check(/card details/.test(runs[0].error) && /card details/.test(runs[1].error), 'the executor refuses clicks and typing on the card page')
  check(runs[2].error === '', 'the executor still scrolls on the card page')
  check(!(await site.textContent('#note')) && (await site.inputValue('#cardnumber')) === '', 'nothing was ordered or typed')

  check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join('; ')}` : ''}`)
} catch (e) {
  failures++
  console.log(`FAIL  ${e.stack ?? e}`)
} finally {
  await context.close()
  server.close()
  rmSync(ext, { recursive: true, force: true })
}

function pickRun(state, label) {
  const a = state.actions.find((x) => x.label === label)
  return { id: a.id, label: a.label, confirmed: false }
}

console.log(failures ? `${failures} failed` : 'all passed')
process.exit(failures ? 1 : 0)
