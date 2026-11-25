import { describe, expect, it } from 'vitest'
import { clip, mergeLabel, rankTier0, riskOf } from '../src/core/actions'
import { appendLog, describePage, FIXED, isCardField, LOG_MAX, mergeRanking, toCsv, type LogRow, type PageAction } from './page'

const field = { autocomplete: '', name: '', id: '', label: '', placeholder: '' }
const act = (id: string, patch: Partial<PageAction> = {}): PageAction => ({
  id,
  kind: 'click',
  label: id,
  risk: 'safe',
  region: 'main',
  ...patch,
})

describe('mergeLabel', () => {
  it('uses the visible text when the names agree', () => {
    expect(mergeLabel('Archive', 'archive')).toBe('Archive')
  })
  it('uses the longer name when it contains the visible text', () => {
    expect(mergeLabel('Archive', 'Archive message from Ana')).toBe('Archive message from Ana')
  })
  it('shows both names when they disagree', () => {
    expect(mergeLabel('Cancel', 'Send')).toBe('Cancel (page names it: Send)')
  })
  it('falls back to whichever name exists', () => {
    expect(mergeLabel('', 'Search mail')).toBe('Search mail')
    expect(mergeLabel('Inbox', '')).toBe('Inbox')
  })
  it('clips long labels to about 40 characters', () => {
    const long = 'a very long link text that goes on and on and on'
    expect(clip(long).length).toBeLessThanOrEqual(40)
    expect(clip(long).endsWith('…')).toBe(true)
  })
})

describe('riskOf', () => {
  it('marks risky words in any name', () => {
    for (const w of ['Send', 'Post reply', 'Pay now', 'Place order', 'Checkout', 'Delete', 'Remove item', 'Confirm', 'Submit'])
      expect(riskOf(['Something', w], null)).toBe('irreversible')
  })
  it('finds a risky aria-label behind safe visible text', () => {
    expect(riskOf([mergeLabel('Cancel', 'Send'), 'Cancel', 'Send'], null)).toBe('irreversible')
  })
  it('keeps plain actions safe', () => {
    for (const w of ['Archive', 'Open message', 'Next page', 'Posts', 'Sender'])
      expect(riskOf([w], null)).toBe('safe')
  })
  it('marks any submit in a form with a password or card field', () => {
    expect(riskOf(['Log in'], { password: true, payment: false })).toBe('irreversible')
    expect(riskOf(['Continue'], { password: false, payment: true })).toBe('irreversible')
    expect(riskOf(['Search'], { password: false, payment: false })).toBe('safe')
  })
})

describe('isCardField', () => {
  it('finds card fields by autocomplete, name, id, or label', () => {
    expect(isCardField({ ...field, autocomplete: 'cc-number' })).toBe(true)
    expect(isCardField({ ...field, autocomplete: 'billing cc-exp' })).toBe(true)
    expect(isCardField({ ...field, name: 'cardNumber' })).toBe(true)
    expect(isCardField({ ...field, id: 'cvv' })).toBe(true)
    expect(isCardField({ ...field, label: 'Expiry date' })).toBe(true)
    expect(isCardField({ ...field, placeholder: 'MM / YY' })).toBe(true)
  })
  it('ignores other fields', () => {
    expect(isCardField({ ...field, name: 'email', label: 'Email address' })).toBe(false)
    expect(isCardField({ ...field, label: 'Discount code' })).toBe(false)
  })
})

describe('rankTier0', () => {
  it('puts main content before navigation, and keeps page order', () => {
    const list = [act('nav1', { region: 'nav' }), act('m1'), act('m2')]
    expect(rankTier0(list, {}).map((a) => a.id)).toEqual(['m1', 'm2', 'nav1'])
  })
  it('puts empty fields of the focused form first, in page order', () => {
    const list = [act('m1'), act('to', { kind: 'type', fill: true }), act('body', { kind: 'type', fill: true })]
    expect(rankTier0(list, {}).map((a) => a.id)).toEqual(['to', 'body', 'm1'])
  })
  it('boosts choices made often on this site', () => {
    const list = [act('m1'), act('nav1', { region: 'nav' })]
    expect(rankTier0(list, { nav1: 2 }).map((a) => a.id)).toEqual(['nav1', 'm1'])
  })
  it('always puts irreversible actions last, even when chosen often', () => {
    const list = [act('send', { risk: 'irreversible', fill: true }), ...FIXED]
    expect(rankTier0(list, { send: 99 }).at(-1)?.id).toBe('send')
  })
})

describe('toCsv', () => {
  it('quotes cells and defuses formulas', () => {
    const csv = toCsv([{ time: 't', site: 'http://a', label: '=HYPERLINK("x")', risk: 'safe' }])
    expect(csv.split('\n')[1]).toBe('"t","http://a","\'=HYPERLINK(""x"")","safe"')
  })
})

describe('describePage', () => {
  it('joins the title and the text, with the whitespace collapsed', () => {
    expect(describePage(' Inbox \n', 'Maya Chen\n\n  Lunch on Friday?')).toBe('The web page "Inbox": Maya Chen Lunch on Friday?')
  })
  it('clips the text to about 600 characters', () => {
    const d = describePage('Long', 'word '.repeat(500))
    expect(d.length).toBeLessThanOrEqual('The web page "Long": '.length + 600)
    expect(d.endsWith('…')).toBe(true)
  })
  it('works without a title or text', () => {
    expect(describePage('', 'Hello')).toBe('The web page: Hello')
    expect(describePage('Inbox', '  ')).toBe('The web page "Inbox"')
  })
})

describe('mergeRanking', () => {
  const tier0 = [act('a'), act('b'), act('c'), act('send', { risk: 'irreversible' })]
  const ids = (ranked: PageAction[]) => ranked.map((a) => a.id)
  it('puts the model order first, then the Tier 0 order', () => {
    expect(ids(mergeRanking(['c', 'a'], tier0))).toEqual(['c', 'a', 'b', 'send'])
  })
  it('keeps irreversible actions last, whatever the model says', () => {
    expect(ids(mergeRanking(['send', 'b'], tier0))).toEqual(['b', 'a', 'c', 'send'])
  })
  it('ignores IDs that are not on the list', () => {
    expect(ids(mergeRanking(['x', 'b'], tier0))).toEqual(['b', 'a', 'c', 'send'])
  })
})

describe('appendLog', () => {
  it('keeps the newest rows', () => {
    const row = (label: string): LogRow => ({ time: 't', site: 's', label, risk: 'safe' })
    const full = Array.from({ length: LOG_MAX }, (_, i) => row(String(i)))
    const next = appendLog(full, row('new'))
    expect(next.length).toBe(LOG_MAX)
    expect(next[0].label).toBe('1')
    expect(next.at(-1)?.label).toBe('new')
  })
})
