// The built-in workspace: its state, the list of valid actions, and one function that applies an action.
// The predictor only ranks validActions(). applyAction() rejects every action that is not in that list.

export type AppName = 'mail' | 'messages' | 'calendar' | 'notes'

export type Verb =
  | 'go' // switch to an app
  | 'open'
  | 'back'
  | 'next-page'
  | 'accept'
  | 'decline'
  | 'add-event'
  | 'archive'
  | 'reply'
  | 'toggle-todo'
  | 'new-note'
  | 'search'
  | 'clear-search'
  | 'delete'
  | 'help'

export type Action = {
  id: string
  app: AppName
  verb: Verb
  target: string
  /** True when the user must give text (reply, decline reason, note, search word) before the action runs. */
  needsText: boolean
  text?: string
  /** False for send, delete, and pay. These need a confirm screen and have no Undo. */
  reversible: boolean
  label: string
}

export type Mail = {
  id: string
  from: string
  subject: string
  pages: string[]
  unread: boolean
  readToEnd: boolean
  archived: boolean
  invite?: { title: string; start: string; end: string }
  response?: { kind: 'accepted' | 'declined' | 'replied'; text: string }
  drafts: string[]
}
export type Message = { from: 'me' | 'them'; text: string }
export type Thread = { id: string; contact: string; messages: Message[]; drafts: string[] }
export type CalendarEvent = { id: string; title: string; start: string; end: string; fromMail?: string }
export type Note = { id: string; title: string; body: string }
export type Todo = { id: string; text: string; done: boolean }

export type View = { app: AppName; open?: string; page: number; query?: string }

export type Workspace = {
  view: View
  mails: Mail[]
  threads: Thread[]
  events: CalendarEvent[]
  notes: Note[]
  todos: Todo[]
}

export const APPS: AppName[] = ['mail', 'messages', 'calendar', 'notes']
const APP_LABEL: Record<AppName, string> = { mail: 'Mail', messages: 'Messages', calendar: 'Calendar', notes: 'Notes' }
export const CAREGIVER = 'thread-caregiver'
export const HELP_TEXT = 'I need help now. Please come.'
const LABEL_MAX = 40

function clip(s: string) {
  return s.length <= LABEL_MAX ? s : `${s.slice(0, LABEL_MAX - 1)}…`
}

function make(app: AppName, verb: Verb, target: string, label: string, opts: Partial<Action> = {}): Action {
  return { id: `${verb}:${target}`, app, verb, target, needsText: false, reversible: true, label: clip(label), ...opts }
}

export const helpAction = make('messages', 'help', CAREGIVER, 'Call for help', { reversible: false })

/** Notes whose title or body contains the query, case ignored. */
export function matchingNotes(ws: Workspace): Note[] {
  const q = ws.view.query?.toLowerCase()
  return q ? ws.notes.filter((n) => `${n.title} ${n.body}`.toLowerCase().includes(q)) : ws.notes
}

/** Every action that is valid in this state. "Call for help" is always in the list. */
export function validActions(ws: Workspace): Action[] {
  const { app, open, page } = ws.view
  const list: Action[] = [helpAction]
  for (const other of APPS) if (other !== app || open) list.push(make(other, 'go', other, `Go to ${APP_LABEL[other]}`))

  if (app === 'mail') {
    const mail = ws.mails.find((m) => m.id === open)
    if (!mail) {
      for (const m of ws.mails) if (!m.archived) list.push(make('mail', 'open', m.id, `Open: ${m.subject}`))
    } else {
      list.push(make('mail', 'back', mail.id, 'Back to inbox'))
      if (page < mail.pages.length - 1) list.push(make('mail', 'next-page', mail.id, 'Read next page'))
      if (!mail.archived) list.push(make('mail', 'archive', mail.id, 'Archive this email'))
      if (!mail.response) {
        list.push(make('mail', 'reply', mail.id, `Reply to ${mail.from}`, { needsText: true, reversible: false }))
        if (mail.invite) {
          list.push(make('mail', 'accept', mail.id, 'Accept invitation', { reversible: false }))
          list.push(make('mail', 'decline', mail.id, 'Decline with a reason', { needsText: true, reversible: false }))
        }
      }
      if (mail.invite && !ws.events.some((e) => e.fromMail === mail.id))
        list.push(make('mail', 'add-event', mail.id, `Add to calendar: ${mail.invite.title}`))
      list.push(make('mail', 'delete', mail.id, 'Delete this email', { reversible: false }))
    }
  }

  if (app === 'messages') {
    const thread = ws.threads.find((t) => t.id === open)
    if (!thread) {
      for (const t of ws.threads) list.push(make('messages', 'open', t.id, `Open chat: ${t.contact}`))
    } else {
      list.push(make('messages', 'back', thread.id, 'Back to chats'))
      list.push(make('messages', 'reply', thread.id, `Reply to ${thread.contact}`, { needsText: true, reversible: false }))
    }
  }

  if (app === 'calendar') {
    for (const e of ws.events) list.push(make('calendar', 'delete', e.id, `Delete event: ${e.title}`, { reversible: false }))
  }

  if (app === 'notes') {
    const note = ws.notes.find((n) => n.id === open)
    if (!note) {
      for (const n of matchingNotes(ws)) list.push(make('notes', 'open', n.id, `Open note: ${n.title}`))
      for (const t of ws.todos) list.push(make('notes', 'toggle-todo', t.id, `${t.done ? 'Undo' : 'Done'}: ${t.text}`))
      list.push(make('notes', 'new-note', 'notes', 'Write a new note', { needsText: true }))
      list.push(make('notes', 'search', 'notes', 'Find a note by a word', { needsText: true }))
      if (ws.view.query) list.push(make('notes', 'clear-search', 'notes', 'Show all notes'))
    } else {
      list.push(make('notes', 'back', note.id, 'Back to notes'))
      list.push(make('notes', 'delete', note.id, 'Delete this note', { reversible: false }))
    }
  }
  return list
}

/** Keeps only the IDs that are valid in this state, in the given order, with no duplicates. */
export function filterValid(ws: Workspace, ids: string[]): Action[] {
  const byId = new Map(validActions(ws).map((a) => [a.id, a]))
  return [...new Set(ids)].flatMap((id) => byId.get(id) ?? [])
}

export const words = (s: string) => s.trim().split(/\s+/).filter(Boolean)

/**
 * Applies one action and returns the new state. The input state does not change.
 * Throws when the action ID is not valid in this state, or when required text is missing.
 */
export function applyAction(ws: Workspace, action: Pick<Action, 'id' | 'text'>): Workspace {
  const a = validActions(ws).find((v) => v.id === action.id)
  if (!a) throw new Error(`Action not valid in this state: ${action.id}`)
  const text = action.text?.trim() ?? ''
  if (a.needsText && !text) throw new Error(`Action needs text: ${a.id}`)

  const view = (v: Partial<View>): View => ({ app: ws.view.app, page: 0, ...v })
  const mails = (f: (m: Mail) => Mail) => ws.mails.map((m) => (m.id === a.target ? f(m) : m))
  const send = (threadId: string, t: string) =>
    ws.threads.map((th) => (th.id === threadId ? { ...th, messages: [...th.messages, { from: 'me' as const, text: t }] } : th))

  switch (a.verb) {
    case 'go':
      return { ...ws, view: view({ app: a.app }) }
    case 'help':
      return { ...ws, threads: send(CAREGIVER, HELP_TEXT) }
    case 'back':
      return { ...ws, view: view({ query: ws.view.query }) }
    case 'open':
      if (a.app === 'mail') {
        const one = ws.mails.find((m) => m.id === a.target)!.pages.length === 1
        return {
          ...ws,
          view: view({ open: a.target }),
          mails: mails((m) => ({ ...m, unread: false, readToEnd: m.readToEnd || one })),
        }
      }
      return { ...ws, view: view({ open: a.target, query: ws.view.query }) }
    case 'next-page': {
      const page = ws.view.page + 1
      return {
        ...ws,
        view: { ...ws.view, page },
        mails: mails((m) => ({ ...m, readToEnd: m.readToEnd || page === m.pages.length - 1 })),
      }
    }
    case 'archive':
      return { ...ws, view: view({}), mails: mails((m) => ({ ...m, archived: true })) }
    case 'accept':
      return { ...ws, mails: mails((m) => ({ ...m, response: { kind: 'accepted', text: 'I accept. See you there.' } })) }
    case 'decline':
      return { ...ws, mails: mails((m) => ({ ...m, response: { kind: 'declined', text } })) }
    case 'reply':
      return a.app === 'mail'
        ? { ...ws, mails: mails((m) => ({ ...m, response: { kind: 'replied', text } })) }
        : { ...ws, threads: send(a.target, text) }
    case 'add-event': {
      const inv = ws.mails.find((m) => m.id === a.target)!.invite!
      return { ...ws, events: [...ws.events, { id: `event-${a.target}`, ...inv, fromMail: a.target }] }
    }
    case 'toggle-todo':
      return { ...ws, todos: ws.todos.map((t) => (t.id === a.target ? { ...t, done: !t.done } : t)) }
    case 'new-note': {
      const id = `note-${ws.notes.length + 1}`
      const title = words(text).slice(0, 4).join(' ')
      return { ...ws, notes: [...ws.notes, { id, title, body: text }], view: view({ open: id }) }
    }
    case 'search':
      return { ...ws, view: view({ query: text }) }
    case 'clear-search':
      return { ...ws, view: view({}) }
    case 'delete':
      if (a.app === 'mail') return { ...ws, view: view({}), mails: ws.mails.filter((m) => m.id !== a.target) }
      if (a.app === 'notes') return { ...ws, view: view({}), notes: ws.notes.filter((n) => n.id !== a.target) }
      return { ...ws, events: ws.events.filter((e) => e.id !== a.target) }
  }
}
