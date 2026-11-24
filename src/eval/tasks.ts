// The 10 evaluation tasks. Each task starts from sampleWorkspace(). done() is true when the tester finished the task.

import { sampleWorkspace } from '../core/sample'
import { applyAction, CAREGIVER, HELP_TEXT, words, type Workspace } from '../core/workspace'

export type Task = {
  id: number | string
  title: string
  instruction: string
  /** The state at the start of the task. */
  start: () => Workspace
  /** The automatic completion check. */
  done: (ws: Workspace) => boolean
}

/** Lower case, no punctuation, single spaces. Use it to compare text. */
export const normalize = (s: string) => words(s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '')).join(' ')

const mail = (ws: Workspace, id: string) => ws.mails.find((m) => m.id === id)
const lastFromMe = (ws: Workspace, threadId: string) =>
  ws.threads
    .find((t) => t.id === threadId)
    ?.messages.filter((m) => m.from === 'me')
    .at(-1)?.text ?? ''
const SAMPLE_NOTES = new Set(sampleWorkspace().notes.map((n) => n.id))

const TASK_LIST: Omit<Task, 'start'>[] = [
  {
    id: 1,
    title: 'Accept an invitation',
    instruction: 'Accept the team lunch invitation.',
    done: (ws) => mail(ws, 'mail-lunch')?.response?.kind === 'accepted',
  },
  {
    id: 2,
    title: 'Decline an invitation',
    instruction: 'Decline the book club invitation. Give a reason of 5 words or more.',
    done: (ws) => {
      const r = mail(ws, 'mail-bookclub')?.response
      return r?.kind === 'declined' && words(r.text).length >= 5
    },
  },
  {
    id: 3,
    title: 'Message the caregiver',
    instruction: 'Tell Sam, your caregiver: "I need water".',
    done: (ws) => normalize(lastFromMe(ws, CAREGIVER)).includes('i need water'),
  },
  {
    id: 4,
    title: 'Add an event',
    instruction: 'Add the team lunch to the calendar.',
    done: (ws) => ws.events.some((e) => e.fromMail === 'mail-lunch'),
  },
  {
    id: 5,
    title: 'Read an email',
    instruction: 'Open the next unread email. Read it to the end.',
    done: (ws) => mail(ws, 'mail-newsletter')?.readToEnd === true,
  },
  {
    id: 6,
    title: 'Archive an email',
    instruction: 'Archive the "Weekly deals" email.',
    done: (ws) => mail(ws, 'mail-deals')?.archived === true,
  },
  {
    id: 7,
    title: 'Write a note',
    instruction: 'Write a note of 5 words or more.',
    done: (ws) => ws.notes.some((n) => !SAMPLE_NOTES.has(n.id) && words(n.body).length >= 5),
  },
  {
    id: 8,
    title: 'Complete a to-do',
    instruction: 'Mark "Call the pharmacy" as done.',
    done: (ws) => ws.todos.some((t) => t.id === 'todo-pharmacy' && t.done),
  },
  {
    id: 9,
    title: 'Answer Mom',
    instruction: 'Answer Mom: "Yes, I am free to talk after dinner."',
    done: (ws) => normalize(lastFromMe(ws, 'thread-mom')) === normalize('Yes, I am free to talk after dinner.'),
  },
  {
    id: 10,
    title: 'Find a note',
    instruction: 'Find the note with the word "medicine". Open it.',
    done: (ws) => ws.view.app === 'notes' && ws.view.open === 'note-doctor',
  },
]

/** True when the last message in the caregiver chat is the help message from the user. */
export function helpDone(ws: Workspace): boolean {
  const last = ws.threads.find((t) => t.id === CAREGIVER)?.messages.at(-1)
  return last?.from === 'me' && last.text === HELP_TEXT
}

export const TASKS: Task[] = TASK_LIST.map((t) => ({ ...t, start: sampleWorkspace }))

/** Applies a list of action IDs to the sample state. */
const after = (...ids: string[]) => () => ids.reduce((ws, id) => applyAction(ws, { id, text: 'medicine' }), sampleWorkspace())

/** "Call for help" from 5 different states (T11). */
export const HELP_TESTS: Task[] = [
  after(),
  after('open:mail-lunch'),
  after('go:messages', 'open:thread-mom'),
  after('go:calendar'),
  after('go:notes', 'search:notes'),
].map((start, i) => ({
  id: `help-${i + 1}`,
  title: `Call for help, state ${i + 1}`,
  instruction: 'Call for help.',
  start,
  done: helpDone,
}))
