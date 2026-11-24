// Simulated user: completes the 10 tasks and the 5 help tests with the space bar only (T3, T11).
// It selects the correct item each time, so its counts are the lowest possible for this design.
// Usage: npm run build && npx vite preview --port 4173, then: node scripts/simulate.mjs [url] [chrome path]
import { chromium } from 'playwright-core'

const URL = process.argv[2] ?? 'http://localhost:4173/'
const CHROME = process.argv[3] ?? process.env.CHROME ?? '/usr/bin/google-chrome'
const STEP_MS = 300

const ROWS = [['␣', 'e', 't', 'a', '⌫', '✓'], ['o', 'i', 'n', 's', 'h', 'r'], ['d', 'l', 'c', 'u', 'm', 'w'], ['f', 'g', 'y', 'p', 'b', 'v'], ['k', 'j', 'x', 'q', 'z'], ['.', ',', '?']]
const T = (text) => ({ text }) // a text to type

const LUNCH = 'Open: Invitation: Team lunch on Friday'
const BOOK = 'Open: Invitation: Book club on Tuesday'
const PATHS = {
  tier0: {
    1: [LUNCH, 'Accept invitation', 'Confirm: Accept invitation'],
    2: [BOOK, 'Decline with a reason', 'I am not well this week.', 'Confirm: Decline with a reason'],
    3: ['Something else', 'Go to an app', 'Go to Messages', 'Open chat: Sam (caregiver)', 'Reply to Sam (caregiver)', 'I need water.', 'Confirm: Reply to Sam (caregiver)'],
    4: [LUNCH, 'Add to calendar: Team lunch'],
    5: ['Open: Clinic news for December', 'Read next page', 'Read next page'],
    6: ['Something else', 'Open an item', 'Open: Weekly deals', 'Archive this email'],
    7: ['Something else', 'Go to an app', 'Go to Notes', 'Write a new note', T('I need to call mom'), '✓'],
    8: ['Something else', 'Go to an app', 'Go to Notes', 'Done: Call the pharmacy'],
    9: ['Something else', 'Go to an app', 'Go to Messages', 'Open chat: Mom', 'Reply to Mom', 'Yes, I am free to talk after dinner.', 'Confirm: Reply to Mom'],
    10: ['Something else', 'Go to an app', 'Go to Notes', 'Find a note by a word', T('medicine'), '✓', 'Open note: Doctor questions'],
  },
  baseline: {
    1: ['Open an item', LUNCH, 'Change this item', 'Accept invitation', 'Confirm: Accept invitation'],
    2: ['Open an item', BOOK, 'Write or reply', 'Decline with a reason', T('I am not well today'), '✓', 'Confirm: Decline with a reason'],
    3: ['Go to an app', 'Go to Messages', 'Open an item', 'Open chat: Sam (caregiver)', 'Write or reply', 'Reply to Sam (caregiver)', T('I need water'), '✓', 'Confirm: Reply to Sam (caregiver)'],
    4: ['Open an item', LUNCH, 'Change this item', 'Add to calendar: Team lunch'],
    5: ['Open an item', 'Open: Clinic news for December', 'Change this item', 'Read next page', 'Change this item', 'Read next page'],
    6: ['Open an item', 'Open: Weekly deals', 'Change this item', 'Archive this email'],
    7: ['Go to an app', 'Go to Notes', 'Write or reply', 'Write a new note', T('I need to call mom'), '✓'],
    8: ['Go to an app', 'Go to Notes', 'Change this item', 'Done: Call the pharmacy'],
    9: ['Go to an app', 'Go to Messages', 'Open an item', 'Open chat: Mom', 'Write or reply', 'Reply to Mom', T('yes, i am free to talk after dinner.'), '✓', 'Confirm: Reply to Mom'],
    10: ['Go to an app', 'Go to Notes', 'Write or reply', 'Find a note by a word', T('medicine'), '✓', 'Open an item', 'Open note: Doctor questions'],
  },
}

const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

const labels = () => page.$$eval('[data-highlight], .rounded-2xl.bg-surface', (els) => els.map((e) => e.textContent))

/** Waits until the card with this label has the highlight, then presses the space bar. */
async function choose(label) {
  const until = Date.now() + 30_000
  while (Date.now() < until) {
    const now = await page.$eval('[data-highlight]', (e) => e.textContent).catch(() => null)
    if (now === label) {
      await page.keyboard.press('Space')
      await page.waitForTimeout(60)
      return
    }
    await page.waitForTimeout(10)
  }
  throw new Error(`No highlight on "${label}". Visible: ${JSON.stringify(await labels())}`)
}

/** Types text with suggestions when they show the next word, otherwise letter by letter on the keyboard. */
async function type(text) {
  const visible = async () => labels()
  let typed = ''
  for (const word of text.split(' ')) {
    for (let i = 0; i <= word.length; i++) {
      if ((await visible()).includes(word)) {
        await choose(word)
        typed += `${word} `
        break
      }
      if (i === word.length) {
        await chooseKey('␣')
        typed += ' '
        break
      }
      await chooseKey(word[i])
    }
  }
  return typed
}

async function chooseKey(char) {
  const key = char.toLowerCase()
  const row = ROWS.find((r) => r.includes(key))
  await choose(row.join(' '))
  await choose(key)
}

async function runTask(button, path) {
  await page.getByRole('button', { name: button, exact: true }).click()
  for (const step of path) {
    if (typeof step === 'string') {
      if (step === '✓') await chooseKey('✓')
      else await choose(step)
    } else await type(step.text)
  }
  await page.getByText(/ in \d+ signals/).waitFor({ timeout: 10_000 })
  console.log(`  ${button}: ${await page.getByText(/ in \d+ signals/).textContent()}`)
}

for (const mode of ['baseline', 'tier0']) {
  await page.goto(URL)
  await page.evaluate(
    ([m, s]) => localStorage.setItem('transcendent.settings', JSON.stringify({ camera: false, stepMs: s, sound: false, mode: m, tester: 'simulated' })),
    [mode, STEP_MS],
  )
  await page.reload()
  await page.getByRole('button', { name: 'Start test session' }).click()
  console.log(mode)
  for (const [id, path] of Object.entries(PATHS[mode])) await runTask(`Task ${id}`, path)
  for (let i = 1; i <= 5; i++) await runTask(`Help ${i}`, ['Call for help', 'Confirm: Call for help'])
  await page.getByRole('button', { name: 'Exit' }).click()
}

const log = await page.evaluate(() => JSON.parse(localStorage.getItem('transcendent.log') ?? '[]'))
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}
for (const mode of ['baseline', 'tier0']) {
  const rs = log.filter((r) => r.mode === mode && typeof r.task === 'number' && r.completed)
  const help = log.filter((r) => r.mode === mode && String(r.task).startsWith('help') && r.completed)
  console.log(`${mode}: ${rs.length}/10 tasks, median signals ${median(rs.map((r) => r.signals))}, help max ${Math.max(...help.map((r) => r.signals))}`)
}
console.log('page errors:', errors)
await browser.close()
