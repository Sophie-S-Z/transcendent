import { describe, expect, it } from 'vitest'
import { rankTier0 } from '../../src/core/actions'
import { GROUPS, readProblem, signature, toActions, type Control } from './predict'

const control = (id: string, patch: Partial<Control> = {}): Control => ({
  id,
  kind: 'invoke',
  label: id,
  names: [id],
  region: 'main',
  fill: false,
  password: false,
  ...patch,
})

describe('toActions', () => {
  it('names the item by what a select does', () => {
    const [save, file, name, text] = toActions([
      control('Save'),
      control('File', { kind: 'expand', region: 'nav' }),
      control('File name', { kind: 'type', fill: true }),
      control('Text editor', { kind: 'focus' }),
    ])
    expect(save).toMatchObject({ label: 'Save', name: 'Save', kind: 'invoke', risk: 'safe', region: 'main' })
    expect(file.label).toBe('Open or close: File')
    expect(name).toMatchObject({ label: 'Write in: File name', fill: true })
    expect(text.label).toBe('Put the cursor in: Text editor')
  })

  it('marks risky names irreversible, also when only a hidden name has the word', () => {
    const [send, ok] = toActions([control('Send'), control('OK', { names: ['OK', 'okButton'] })])
    expect(send.risk).toBe('irreversible')
    expect(ok.risk).toBe('safe')
    const [pay] = toActions([control('Continue', { names: ['Continue', 'Pay now'] })])
    expect(pay.risk).toBe('irreversible')
  })

  it('never types into a password field', () => {
    const [pw] = toActions([control('Password', { kind: 'type', password: true })])
    expect(pw).toMatchObject({ kind: 'focus', password: true, label: 'Put the cursor in: Password' })
  })

  it('ranks empty fields first and irreversible items last', () => {
    const ranked = rankTier0(toActions([control('Delete'), control('Menu', { region: 'nav' }), control('Open'), control('Name', { kind: 'type', fill: true })]), {})
    expect(ranked.map((a) => a.name)).toEqual(['Name', 'Open', 'Menu', 'Delete'])
  })
})

describe('signature', () => {
  it('changes when an id or a label changes, and not otherwise', () => {
    const list = [control('a'), control('b')]
    expect(signature([control('a'), control('b')])).toBe(signature(list))
    expect(signature([control('a'), control('b', { label: 'c' })])).not.toBe(signature(list))
    expect(signature([control('a')])).not.toBe(signature(list))
    expect(signature([control('a', { fill: true }), control('b')])).toBe(signature(list))
  })
})

describe('readProblem', () => {
  const win = { title: 'Disk Management', process: 'mmc.exe', elevated: true, controls: [] }
  it('names a window that runs as administrator', () => {
    expect(readProblem(win)).toBe('Transcendent cannot read Disk Management. It may run as administrator.')
    expect(readProblem({ ...win, title: '' })).toBe('Transcendent cannot read mmc.exe. It may run as administrator.')
  })
  it('says nothing when the read found controls', () => {
    expect(readProblem({ ...win, controls: [control('a')] })).toBe('')
    expect(readProblem({ ...win, elevated: false })).toBe('Transcendent found no controls in Disk Management.')
  })
})

describe('GROUPS', () => {
  it('puts each item in one group', () => {
    const actions = toActions([control('Bold', { kind: 'toggle' }), control('Send'), control('Name', { kind: 'type' })])
    for (const a of actions) expect(GROUPS.filter(([, test]) => test(a))).toHaveLength(1)
  })
})

