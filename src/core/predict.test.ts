import { describe, expect, it } from 'vitest'
import { countKey, rankActions } from './predict'
import { sampleWorkspace } from './sample'
import { applyAction, validActions, type Workspace } from './workspace'

const act = (ws: Workspace, id: string, text?: string) => applyAction(ws, { id, text })
const ids = (ws: Workspace, counts = {}) => rankActions(ws, counts).map((a) => a.id)

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

const go = (app: string) => act(sampleWorkspace(), `go:${app}`)

describe('rankActions', () => {
  const states = reachable(2)

  it('returns only valid IDs, never help, and at least 4 when 4 exist', () => {
    for (const ws of states) {
      const valid = validActions(ws).filter((a) => a.verb !== 'help').map((a) => a.id)
      const ranked = ids(ws)
      expect(ranked.every((id) => valid.includes(id))).toBe(true)
      expect(ranked.some((id) => id.startsWith('help:'))).toBe(false)
      if (valid.length >= 4) expect(ranked.length).toBeGreaterThanOrEqual(4)
    }
  })

  it('ranks every state in 100 ms or less', () => {
    for (const ws of states) {
      const start = performance.now()
      rankActions(ws, { 'mail:open': 3 })
      expect(performance.now() - start).toBeLessThanOrEqual(100)
    }
  })

  it('puts unread mails first in inbox order', () => {
    expect(ids(sampleWorkspace()).slice(0, 4)).toEqual([
      'open:mail-newsletter',
      'open:mail-lunch',
      'open:mail-bookclub',
      'open:mail-pharmacy',
    ])
  })

  it('puts next-page first in a mail with more pages', () => {
    expect(ids(act(sampleWorkspace(), 'open:mail-newsletter'))[0]).toBe('next-page:mail-newsletter')
  })

  it('ranks accept, add-event, decline first in an open invitation', () => {
    expect(ids(act(sampleWorkspace(), 'open:mail-lunch')).slice(0, 3)).toEqual([
      'accept:mail-lunch',
      'add-event:mail-lunch',
      'decline:mail-lunch',
    ])
  })

  it('ranks archive and reply above back and delete in a mail read to the end', () => {
    const ranked = ids(act(sampleWorkspace(), 'open:mail-pharmacy'))
    expect(ranked.slice(0, 3)).toEqual(['archive:mail-pharmacy', 'reply:mail-pharmacy', 'back:mail-pharmacy'])
    expect(ranked.at(-1)).toBe('delete:mail-pharmacy')
  })

  it('puts threads with a last message from them first, and reply first in a thread', () => {
    const list = go('messages')
    expect(ids(list).slice(0, 3)).toEqual(['open:thread-caregiver', 'open:thread-mom', 'open:thread-ana'])
    expect(ids(act(list, 'open:thread-ana'))[0]).toBe('reply:thread-ana')
  })

  it('ranks open todos, search, and new-note above opens, and done todos low', () => {
    const ranked = ids(go('notes'))
    expect(ranked.slice(0, 4)).toEqual(['toggle-todo:todo-pharmacy', 'toggle-todo:todo-plants', 'new-note:notes', 'search:notes'])
    expect(ranked.indexOf('toggle-todo:todo-chapter')).toBeGreaterThan(ranked.indexOf('open:note-gifts'))
    expect(ranked.indexOf('go:mail')).toBeGreaterThan(ranked.indexOf('open:note-gifts'))
  })

  it('ranks go actions first in the calendar and delete last', () => {
    const ranked = ids(go('calendar'))
    expect(ranked.slice(0, 3)).toEqual(['go:mail', 'go:messages', 'go:notes'])
    expect(ranked.at(-1)).toBe('delete:event-therapy')
  })

  it('moves a frequently chosen action up, but never puts delete above other actions', () => {
    const ws = act(sampleWorkspace(), 'open:mail-pharmacy')
    const back = rankActions(ws, {})[2]
    expect(ids(ws, { [countKey(back)]: 20 })[0]).toBe('back:mail-pharmacy')
    expect(ids(ws, { 'mail:delete': 1e9 }).at(-1)).toBe('delete:mail-pharmacy')
  })
})

describe('rankActions after a note search', () => {
  it('ranks the matching note first', () => {
    let ws = applyAction(sampleWorkspace(), { id: 'go:notes' })
    ws = applyAction(ws, { id: 'search:notes', text: 'medicine' })
    expect(rankActions(ws, {})[0].id).toBe('open:note-doctor')
  })
})
