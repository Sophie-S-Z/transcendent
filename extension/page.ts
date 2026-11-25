// Pure parts of the page reader: labels, the risk check, card-field detection, the Tier 0 page ranker, and the CSV log.
// The content script and the side panel both use them. No DOM access here, so tests run in node.

export type Kind = 'click' | 'type' | 'scroll' | 'back' | 'next-tab'
export type Risk = 'safe' | 'irreversible'
export type Region = 'main' | 'nav' | 'other'
/** One valid action on the page. `fill` marks an empty field in the form that has focus. */
export type PageAction = { id: string; kind: Kind; label: string; risk: Risk; region: Region; fill?: boolean }
/** What the reader sends to the panel. `payments` is true when the page has a card field. */
export type PageState = { actions: PageAction[]; payments: boolean }
export type LogRow = { time: string; site: string; label: string; risk: Risk }

export const FIXED: PageAction[] = [
  { id: 'scroll-down', kind: 'scroll', label: 'Scroll down one screen', risk: 'safe', region: 'other' },
  { id: 'scroll-up', kind: 'scroll', label: 'Scroll up', risk: 'safe', region: 'other' },
  { id: 'back', kind: 'back', label: 'Go back', risk: 'safe', region: 'other' },
  { id: 'next-tab', kind: 'next-tab', label: 'Next tab', risk: 'safe', region: 'other' },
]

export const PAYMENT_NOTICE = 'This page asks for card details, and Transcendent does not make payments, so it can only scroll or go back here.'

/** True for the action kinds that work on a page with a card field. */
export const allowedWithPayments = (kind: Kind) => kind === 'scroll' || kind === 'back' || kind === 'next-tab'

const LABEL_MAX = 40
const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

/** Cuts a label to `max` characters, with an ellipsis. */
export function clip(s: string, max = LABEL_MAX): string {
  const t = norm(s)
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t
}

/**
 * The card label from the visible text and the accessible name.
 * When the name only adds words to the visible text, the label is the name.
 * When they disagree, the label shows both, so a page cannot hide what a button does.
 */
export function mergeLabel(visible: string, name: string): string {
  const v = norm(visible)
  const n = norm(name)
  if (!v || !n) return clip(v || n)
  if (n.toLowerCase() === v.toLowerCase()) return clip(v)
  if (n.toLowerCase().includes(v.toLowerCase())) return clip(n)
  return `${clip(v, 18)} (page names it: ${clip(n, 18)})`
}

const RISKY = /\b(send|post|publish|pay|buy|order|purchase|checkout|check out|delete|remove|submit|transfer|confirm)\b/i

/**
 * The risk of a click. Any name with a risky word, or a submit in a form with a password or card field, is irreversible.
 * `names` holds every name of the element (visible text, aria-label, value, title) and of its form when it submits one.
 */
export function riskOf(names: string[], submit: { password: boolean; payment: boolean } | null): Risk {
  if (names.some((n) => RISKY.test(n))) return 'irreversible'
  return submit && (submit.password || submit.payment) ? 'irreversible' : 'safe'
}

const CARD = /card.?num|cc.?num|credit.?card|debit.?card|\bcvc\b|\bcvv\b|\bcsc\b|security.?code|expir|exp.?(date|month|year)|\bmm\s*\/\s*yy\b/i

/** True when a form field asks for card details. */
export function isCardField(f: { autocomplete: string; name: string; id: string; label: string; placeholder: string }): boolean {
  return /\bcc-/i.test(f.autocomplete) || [f.name, f.id, f.label, f.placeholder].some((s) => CARD.test(s))
}

const REGION_ORDER: Record<Region, number> = { main: 0, nav: 1, other: 2 }

/**
 * Tier 0 for web pages. Empty fields of the form that has focus come first, in page order.
 * Then the actions this user chose most often on this site, then main content before navigation.
 * Irreversible actions are always last. Ties keep the page order.
 */
export function rankPage(actions: PageAction[], counts: Record<string, number>): PageAction[] {
  const key = (a: PageAction) => [Number(a.risk === 'irreversible'), Number(!a.fill), -(counts[a.label] ?? 0), REGION_ORDER[a.region]]
  return actions
    .map((a) => ({ a, k: key(a) }))
    .sort((x, y) => x.k.reduce((d, v, i) => d || v - y.k[i], 0))
    .map((x) => x.a)
}

/** "Something else" groups every action by kind. */
export const GROUPS: [string, (a: PageAction) => boolean][] = [
  ['Links and buttons', (a) => a.kind === 'click' && a.risk === 'safe'],
  ['Write in a field', (a) => a.kind === 'type'],
  ['Scroll and move', (a) => allowedWithPayments(a.kind)],
  ['Send, buy, or delete', (a) => a.risk === 'irreversible'],
]

/** One CSV cell. Quotes every cell, and stops a spreadsheet from reading page text as a formula. */
const cell = (s: string) => `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`

export function toCsv(rows: LogRow[]): string {
  return ['time,site,label,risk', ...rows.map((r) => [r.time, r.site, r.label, r.risk].map(cell).join(','))].join('\n')
}
