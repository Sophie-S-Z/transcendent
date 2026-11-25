import { describe, expect, it } from 'vitest'
import { sampleWorkspace } from '../core/sample'
import { applyAction, type Workspace } from '../core/workspace'
import { median, savingPct, summarize, testerName, toCsv, type TaskRecord } from './log'
import { HELP_TESTS, helpDone, TASKS } from './tasks'

type Step = [id: string, text?: string]
const run = (steps: Step[]) => steps.reduce((ws: Workspace, [id, text]) => applyAction(ws, { id, text }), sampleWorkspace())

const SCRIPTS: Record<number | string, Step[]> = {
  1: [['open:mail-lunch'], ['accept:mail-lunch']],
  2: [['open:mail-bookclub'], ['decline:mail-bookclub', 'I have a doctor visit then.']],
  3: [['go:messages'], ['open:thread-caregiver'], ['reply:thread-caregiver', 'I need water.']],
  4: [['open:mail-lunch'], ['add-event:mail-lunch']],
  5: [['open:mail-newsletter'], ['next-page:mail-newsletter'], ['next-page:mail-newsletter']],
  6: [['open:mail-deals'], ['archive:mail-deals']],
  7: [['go:notes'], ['new-note:notes', 'Buy stamps at the post office']],
  8: [['go:notes'], ['toggle-todo:todo-pharmacy']],
  9: [['go:messages'], ['open:thread-mom'], ['reply:thread-mom', 'yes  I am free to talk after dinner']],
  10: [['go:notes'], ['search:notes', 'medicine'], ['open:note-doctor']],
}

describe('tasks', () => {
  it('has ids 1 to 10', () => expect(TASKS.map((t) => t.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))

  for (const task of TASKS)
    it(`task ${task.id} is not done at start and a script completes it`, () => {
      expect(task.done(sampleWorkspace())).toBe(false)
      expect(task.done(run(SCRIPTS[task.id]))).toBe(true)
    })

  it('rejects a short decline reason and a wrong answer to Mom', () => {
    expect(TASKS[1].done(run([['open:mail-bookclub'], ['decline:mail-bookclub', 'Too busy.']]))).toBe(false)
    expect(TASKS[8].done(run([['go:messages'], ['open:thread-mom'], ['reply:thread-mom', 'I love you, Mom.']]))).toBe(false)
  })

  it('starts each help test in a different state, and one help action completes it', () => {
    const views = HELP_TESTS.map((t) => JSON.stringify(t.start().view))
    expect(new Set(views).size).toBe(5)
    for (const t of HELP_TESTS) {
      expect(t.done(t.start())).toBe(false)
      expect(t.done(applyAction(t.start(), { id: 'help:thread-caregiver' }))).toBe(true)
    }
  })

  it('helpDone is true after Call for help', () => {
    expect(helpDone(sampleWorkspace())).toBe(false)
    expect(helpDone(run([['help:thread-caregiver']]))).toBe(true)
  })
})

const rec = (r: Partial<TaskRecord>): TaskRecord => ({
  session: 's1', tester: 't1', mode: 'baseline', task: 1, signals: 10, ms: 1000, errors: 0,
  topHits: 0, top5Hits: 0, steps: 0, completed: true, startedAt: '2026-11-24T10:00:00.000Z', ...r,
})

describe('log', () => {
  it('toCsv quotes a field with a comma and a quote', () => {
    const lines = toCsv([rec({ tester: 'Lee, "Al"' })]).split('\r\n')
    expect(lines[0]).toBe('session,tester,mode,task,signals,ms,errors,topHits,top5Hits,steps,completed,startedAt,scenario')
    expect(lines[1]).toBe('s1,"Lee, ""Al""",baseline,1,10,1000,0,0,0,0,true,2026-11-24T10:00:00.000Z,')
  })

  it('toCsv prints the scenario, and an empty field for an old record without one', () => {
    const lines = toCsv([rec({ task: 'care-1', scenario: 'care' }), rec({})]).split('\r\n')
    expect(lines[1]).toBe('s1,t1,baseline,care-1,10,1000,0,0,0,0,true,2026-11-24T10:00:00.000Z,care')
    expect(lines[2]).toBe('s1,t1,baseline,1,10,1000,0,0,0,0,true,2026-11-24T10:00:00.000Z,')
  })

  it('median of odd, even, and empty lists', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(median([])).toBe(0)
  })

  it('names an empty tester "unnamed", so every run is logged', () => {
    expect(testerName('  ')).toBe('unnamed')
    expect(testerName(' Ana ')).toBe('Ana')
  })

  it('summarize groups by mode and ignores incomplete records and other tests', () => {
    const s = summarize([
      rec({ signals: 20, ms: 3000 }),
      rec({ signals: 10, ms: 1000 }),
      rec({ signals: 99, completed: false }),
      rec({ signals: 2, task: 'help-1' }),
      rec({ signals: 0, task: 'gate-a' }),
      rec({ mode: 'tier0', signals: 8, topHits: 3, top5Hits: 4, steps: 4 }),
    ])
    expect(s).toEqual([
      { mode: 'baseline', tasks: 2, medianSignals: 15, minSignals: 10, maxSignals: 20, medianMs: 2000, minMs: 1000, maxMs: 3000, topRate: 0, top5Rate: 0 },
      { mode: 'tier0', tasks: 1, medianSignals: 8, minSignals: 8, maxSignals: 8, medianMs: 1000, minMs: 1000, maxMs: 1000, topRate: 0.75, top5Rate: 1 },
    ])
  })

  it('savingPct', () => {
    expect(savingPct(20, 8)).toBe(60)
    expect(savingPct(0, 5)).toBe(0)
  })
})
