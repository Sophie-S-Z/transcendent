import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadSettings, saveSettings } from './settings'

const store = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial))
  vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) })
}

describe('settings', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('gives the defaults when nothing is stored', () => {
    store()
    expect(loadSettings()).toMatchObject({ camera: true, stepMs: 1200, mode: 'tier0', scenario: 'eval' })
  })

  it('fills keys that an older version did not save', () => {
    store({ 'transcendent.settings': '{"stepMs":2000}' })
    expect(loadSettings()).toMatchObject({ stepMs: 2000, sound: true, scenario: 'eval' })
  })

  it('gives the defaults for broken data', () => {
    store({ 'transcendent.settings': '{not json' })
    expect(loadSettings().stepMs).toBe(1200)
  })

  it('reads back what it saves', () => {
    store()
    const s = { ...loadSettings(), mode: 'baseline' as const, tester: 'T1' }
    saveSettings(s)
    expect(loadSettings()).toEqual(s)
  })
})
