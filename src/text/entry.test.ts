import { describe, expect, it } from 'vitest'
import { sampleWorkspace } from '../core/sample'
import { validActions, type Workspace } from '../core/workspace'
import { acceptWord, DELETE, DONE, draftsFor, KEY_ROWS, nextWords, SPACE, typeKey } from './entry'

const ws = sampleWorkspace()
const action = (state: Workspace, id: string) => validActions(state).find((a) => a.id === id)!

describe('draftsFor', () => {
  it('gives mail drafts for mail reply and decline', () => {
    const state: Workspace = { ...ws, view: { app: 'mail', open: 'mail-lunch', page: 0 } }
    const drafts = ws.mails.find((m) => m.id === 'mail-lunch')!.drafts
    expect(draftsFor(state, action(state, 'reply:mail-lunch'))).toEqual(drafts)
    expect(draftsFor(state, action(state, 'decline:mail-lunch'))).toEqual(drafts)
  })

  it('gives thread drafts for messages reply', () => {
    const state: Workspace = { ...ws, view: { app: 'messages', open: 'thread-mom', page: 0 } }
    expect(draftsFor(state, action(state, 'reply:thread-mom'))).toEqual(ws.threads.find((t) => t.id === 'thread-mom')!.drafts)
  })

  it('gives no drafts for new-note and search', () => {
    const state: Workspace = { ...ws, view: { app: 'notes', page: 0 } }
    expect(draftsFor(state, action(state, 'new-note:notes'))).toEqual([])
    expect(draftsFor(state, action(state, 'search:notes'))).toEqual([])
  })
})

describe('KEY_ROWS', () => {
  const keys = KEY_ROWS.flat()

  it('has every letter exactly once and the 3 special keys', () => {
    for (const c of 'abcdefghijklmnopqrstuvwxyz') expect(keys.filter((k) => k === c)).toHaveLength(1)
    expect(KEY_ROWS[0]).toEqual(expect.arrayContaining([SPACE, DELETE, DONE]))
  })

  it('puts letters in frequency order', () => {
    expect(keys.filter((k) => /^[a-z]$/.test(k)).join('')).toBe('etaoinshrdlcumwfgypbvkjxqz')
  })
})

describe('typeKey', () => {
  it('applies letter, space, delete, and done', () => {
    expect(typeKey('wa', 't')).toBe('wat')
    expect(typeKey('I', SPACE)).toBe('I ')
    expect(typeKey('', DELETE)).toBe('')
    expect(typeKey('ab', DELETE)).toBe('a')
    expect(typeKey('ab', DONE)).toBe('ab')
  })
})

describe('nextWords', () => {
  it('completes the partial word', () => {
    const out = nextWords('I need wat', ws)
    expect(out).toContain('water')
    expect(out).not.toContain('wat')
  })

  it('predicts the next word from the workspace text', () => {
    expect(nextWords('I need ', ws)).toContain('water')
  })

  it('writes I in upper case', () => {
    expect(nextWords('', ws)).toContain('I')
  })

  it('returns at most 4 unique items', () => {
    for (const text of ['', 'I ', 't', 'the ', 'I need ', 'zzz']) {
      const out = nextWords(text, ws)
      expect(out.length).toBeLessThanOrEqual(4)
      expect(new Set(out).size).toBe(out.length)
    }
  })
})

describe('acceptWord', () => {
  it('replaces the partial word and adds a space', () => {
    expect(acceptWord('I need wa', 'water')).toBe('I need water ')
    expect(acceptWord('I need ', 'water')).toBe('I need water ')
  })
})
