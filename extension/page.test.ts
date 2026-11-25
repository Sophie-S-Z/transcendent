import { describe, expect, it } from 'vitest'
import { clip, FIXED, isCardField, mergeLabel, rankPage, riskOf, toCsv, type PageAction } from './page'

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

describe('rankPage', () => {
  it('puts main content before navigation, and keeps page order', () => {
    const list = [act('nav1', { region: 'nav' }), act('m1'), act('m2')]
    expect(rankPage(list, {}).map((a) => a.id)).toEqual(['m1', 'm2', 'nav1'])
  })
  it('puts empty fields of the focused form first, in page order', () => {
    const list = [act('m1'), act('to', { kind: 'type', fill: true }), act('body', { kind: 'type', fill: true })]
    expect(rankPage(list, {}).map((a) => a.id)).toEqual(['to', 'body', 'm1'])
  })
  it('boosts choices made often on this site', () => {
    const list = [act('m1'), act('nav1', { region: 'nav' })]
    expect(rankPage(list, { nav1: 2 }).map((a) => a.id)).toEqual(['nav1', 'm1'])
  })
  it('always puts irreversible actions last, even when chosen often', () => {
    const list = [act('send', { risk: 'irreversible', fill: true }), ...FIXED]
    expect(rankPage(list, { send: 99 }).at(-1)?.id).toBe('send')
  })
})

describe('toCsv', () => {
  it('quotes cells and defuses formulas', () => {
    const csv = toCsv([{ time: 't', site: 'http://a', label: '=HYPERLINK("x")', risk: 'safe' }])
    expect(csv.split('\n')[1]).toBe('"t","http://a","\'=HYPERLINK(""x"")","safe"')
  })
})
