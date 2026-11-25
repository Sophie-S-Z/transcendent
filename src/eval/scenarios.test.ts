import { describe, expect, it } from 'vitest'
import { applyAction, type Workspace } from '../core/workspace'
import { SCENARIOS, scenarioById } from './scenarios'
import { TASKS } from './tasks'

type Step = [id: string, text?: string]
const run = (start: Workspace, steps: Step[]) => steps.reduce((ws, [id, text]) => applyAction(ws, { id, text }), start)

// The text of each step is a draft from the sample data, or text the user types.
const SCRIPTS: Record<string, Step[]> = {
  'care-1': [['go:messages'], ['open:thread-caregiver'], ['reply:thread-caregiver', 'I need water.']],
  'care-2': [['go:messages'], ['open:thread-caregiver'], ['reply:thread-caregiver', 'Please help me change position.']],
  'care-3': [['go:messages'], ['open:thread-daughter'], ['reply:thread-daughter', 'Yes, come at six.']],
  'care-4': [['help:thread-caregiver']],
  'work-1': [['open:mail-team'], ['accept:mail-team']],
  'work-2': [['open:mail-late'], ['decline:mail-late', 'I cannot join meetings after six.']],
  'work-3': [['open:mail-client'], ['add-event:mail-client']],
  'work-4': [['open:mail-news'], ['archive:mail-news']],
  'work-5': [['open:mail-manager'], ['reply:mail-manager', 'Yes, I will send it by Friday.']],
  'study-1': [['go:notes'], ['new-note:notes', 'cells make energy in the mitochondria']],
  'study-2': [['go:notes'], ['search:notes', 'exam'], ['open:note-exam']],
  'study-3': [['go:notes'], ['toggle-todo:todo-essay']],
  'study-4': [['open:mail-course'], ['next-page:mail-course'], ['next-page:mail-course']],
  'health-1': [['open:mail-doctor'], ['accept:mail-doctor']],
  'health-2': [['go:messages'], ['open:thread-pharmacy']],
  'health-3': [['go:notes'], ['new-note:notes', 'take the blue pill at eight']],
  'health-4': [['go:messages'], ['open:thread-son'], ['reply:thread-son', 'I feel fine today.']],
  'judges-1': [
    ['go:messages'],
    ['open:thread-caregiver'],
    ['reply:thread-caregiver', 'I need water.'],
    ['go:mail'],
    ['open:mail-meeting'],
    ['accept:mail-meeting'],
    ['help:thread-caregiver'],
  ],
}
const packTasks = SCENARIOS.filter((s) => s.id !== 'eval').flatMap((s) => s.tasks)

describe('scenarios', () => {
  it('keeps the evaluation set first and unchanged', () => {
    expect(SCENARIOS[0].id).toBe('eval')
    expect(SCENARIOS[0].tasks.slice(0, 10)).toEqual(TASKS)
    expect(scenarioById('nope').id).toBe('eval')
  })

  it('gives pack tasks unique string ids, so summarize() ignores them', () => {
    const ids = packTasks.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(typeof id).toBe('string')
    expect(Object.keys(SCRIPTS).sort()).toEqual([...ids].sort())
  })

  it('has 3 drafts for each mail and each chat', () => {
    for (const s of SCENARIOS) {
      const ws = s.workspace()
      for (const x of [...ws.mails, ...ws.threads]) expect(x.drafts).toHaveLength(3)
    }
  })

  for (const task of packTasks)
    it(`${task.id} is not done at start and a script completes it`, () => {
      expect(task.done(task.start())).toBe(false)
      expect(task.done(run(task.start(), SCRIPTS[task.id]))).toBe(true)
    })

  it('rejects a short decline reason and a wrong answer to the daughter', () => {
    const [care, work] = [scenarioById('care'), scenarioById('work')]
    expect(work.tasks[1].done(run(work.workspace(), [['open:mail-late'], ['decline:mail-late', 'Too late.']]))).toBe(false)
    const wrong: Step[] = [['go:messages'], ['open:thread-daughter'], ['reply:thread-daughter', 'I love you, Nora.']]
    expect(care.tasks[2].done(run(care.workspace(), wrong))).toBe(false)
  })

  it('judges task needs all three steps', () => {
    const task = scenarioById('judges').tasks[0]
    expect(task.done(run(task.start(), SCRIPTS['judges-1'].slice(0, -1)))).toBe(false)
  })

  it('each start is a fresh copy', () => {
    const ws = scenarioById('care').workspace()
    ws.notes.length = 0
    expect(scenarioById('care').workspace().notes.length).toBeGreaterThan(0)
  })
})
