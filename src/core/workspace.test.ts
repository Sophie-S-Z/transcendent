import { describe, expect, it } from 'vitest'
import { sampleWorkspace } from './sample'
import { applyAction, CAREGIVER, filterValid, HELP_TEXT, validActions, type Workspace } from './workspace'

const act = (ws: Workspace, id: string, text?: string) => applyAction(ws, { id, text })

/** Every state reachable from the sample in `depth` actions. */
function reachable(depth: number): Workspace[] {
  let frontier = [sampleWorkspace()]
  const all = [...frontier]
  for (let i = 0; i < depth; i++) {
    frontier = frontier.flatMap((ws) => validActions(ws).map((a) => act(ws, a.id, a.needsText ? 'test words here' : undefined)))
    all.push(...frontier)
  }
  return all
}

describe('validActions', () => {
  const states = reachable(3)

  it('lists "Call for help" in every state', () => {
    for (const ws of states) expect(validActions(ws).some((a) => a.verb === 'help')).toBe(true)
  })

  it('gives unique IDs and labels of 40 characters or fewer', () => {
    for (const ws of states) {
      const list = validActions(ws)
      expect(new Set(list.map((a) => a.id)).size).toBe(list.length)
      for (const a of list) expect(a.label.length).toBeLessThanOrEqual(40)
    }
  })

  it('marks every send and delete as not reversible', () => {
    for (const ws of states)
      for (const a of validActions(ws))
        if (['reply', 'accept', 'decline', 'delete', 'help'].includes(a.verb)) expect(a.reversible).toBe(false)
  })
})

describe('applyAction', () => {
  it('rejects an action ID that is not valid in this state (T5)', () => {
    expect(() => act(sampleWorkspace(), 'delete:everything')).toThrow()
    expect(() => act(sampleWorkspace(), 'accept:mail-lunch')).toThrow() // valid only when that mail is open
  })

  it('rejects a text action with no text', () => {
    const ws = act(sampleWorkspace(), 'go:notes')
    expect(() => act(ws, 'new-note:notes')).toThrow()
    expect(() => act(ws, 'new-note:notes', '   ')).toThrow()
  })

  it('does not change the input state', () => {
    const ws = sampleWorkspace()
    const before = structuredClone(ws)
    act(act(ws, 'open:mail-lunch'), 'archive:mail-lunch')
    expect(ws).toEqual(before)
  })

  it('accepts an invitation and adds its event', () => {
    let ws = act(sampleWorkspace(), 'open:mail-lunch')
    ws = act(act(ws, 'accept:mail-lunch'), 'add-event:mail-lunch')
    expect(ws.mails.find((m) => m.id === 'mail-lunch')!.response?.kind).toBe('accepted')
    expect(ws.events.some((e) => e.fromMail === 'mail-lunch')).toBe(true)
    expect(validActions(ws).some((a) => a.id === 'add-event:mail-lunch')).toBe(false)
  })

  it('marks a long email as read to the end only on its last page', () => {
    let ws = act(sampleWorkspace(), 'open:mail-newsletter')
    ws = act(ws, 'next-page:mail-newsletter')
    expect(ws.mails[0].readToEnd).toBe(false)
    ws = act(ws, 'next-page:mail-newsletter')
    expect(ws.mails[0].readToEnd).toBe(true)
    expect(validActions(ws).some((a) => a.verb === 'next-page')).toBe(false)
  })

  it('sends the help message to the caregiver from any app', () => {
    const ws = act(act(sampleWorkspace(), 'go:notes'), 'help:' + CAREGIVER)
    expect(ws.threads.find((t) => t.id === CAREGIVER)!.messages.at(-1)).toEqual({ from: 'me', text: HELP_TEXT })
  })

  it('finds a note by one word', () => {
    let ws = act(act(sampleWorkspace(), 'go:notes'), 'search:notes', 'medicine')
    expect(validActions(ws).filter((a) => a.verb === 'open').map((a) => a.target)).toEqual(['note-doctor'])
    ws = act(ws, 'open:note-doctor')
    expect(ws.view.open).toBe('note-doctor')
  })
})

describe('filterValid', () => {
  it('drops IDs that are not valid and keeps the order (T5)', () => {
    const ids = filterValid(sampleWorkspace(), ['open:mail-deals', 'invented:action', 'open:mail-lunch', 'open:mail-deals'])
    expect(ids.map((a) => a.id)).toEqual(['open:mail-deals', 'open:mail-lunch'])
  })
})
