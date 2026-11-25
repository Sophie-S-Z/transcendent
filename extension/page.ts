// Pure parts of the page reader: the fixed actions, card-field detection, the groups, and the CSV log.
// The content script and the side panel both use them. No DOM access here, so tests run in node.

import type { Region, Risk } from '../src/core/actions'

export type Kind = 'click' | 'type' | 'scroll' | 'back' | 'next-tab'
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

const CARD = /card.?num|cc.?num|credit.?card|debit.?card|\bcvc\b|\bcvv\b|\bcsc\b|security.?code|expir|exp.?(date|month|year)|\bmm\s*\/\s*yy\b/i

/** True when a form field asks for card details. */
export function isCardField(f: { autocomplete: string; name: string; id: string; label: string; placeholder: string }): boolean {
  return /\bcc-/i.test(f.autocomplete) || [f.name, f.id, f.label, f.placeholder].some((s) => CARD.test(s))
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
