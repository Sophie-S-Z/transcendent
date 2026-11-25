import { APP_LABEL, APPS, matchingNotes, type Workspace } from '../core/workspace'

// This view is read-only. It has no buttons and no click handlers.

const DATE: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
const TIME: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }

// Show a start and end time as one readable line.
function when(start: string, end: string) {
  return `${new Date(start).toLocaleString('en-US', DATE)} to ${new Date(end).toLocaleTimeString('en-US', TIME)}`
}

const row = 'border-b border-line py-3'

function MailView({ ws }: { ws: Workspace }) {
  const mail = ws.mails.find((m) => m.id === ws.view.open)
  if (!mail)
    return (
      <ul className="flex flex-col gap-2">
        {ws.mails
          .filter((m) => !m.archived)
          .map((m) => (
            <li key={m.id} className={`${row} ${m.unread ? 'font-bold' : ''}`}>
              {m.unread && <span aria-label="Unread" className="mr-2 inline-block size-2 rounded-full bg-ink align-middle" />}
              {m.from}: {m.subject}
            </li>
          ))}
      </ul>
    )
  const r = mail.response
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted">From {mail.from}</p>
      <h2 className="text-xl font-semibold">{mail.subject}</h2>
      <p className={row}>{mail.pages[ws.view.page]}</p>
      <p className="text-muted">
        Page {ws.view.page + 1} of {mail.pages.length}
      </p>
      {mail.invite && (
        <p className={row}>
          Invitation: {mail.invite.title}, {when(mail.invite.start, mail.invite.end)}
        </p>
      )}
      {r && (
        <p className="font-bold">
          {r.kind === 'accepted' ? 'You accepted' : `${r.kind === 'declined' ? 'You declined' : 'You replied'}: ${r.text}`}
        </p>
      )}
    </div>
  )
}

function MessagesView({ ws }: { ws: Workspace }) {
  const thread = ws.threads.find((t) => t.id === ws.view.open)
  if (!thread)
    return (
      <ul className="flex flex-col gap-2">
        {ws.threads.map((t) => {
          const last = t.messages.at(-1)
          return (
            <li key={t.id} className={row}>
              <span className="font-bold">{t.contact}</span>
              {last && (
                <span className="block text-muted">
                  {last.from === 'them' ? '● ' : 'You: '}
                  {last.text}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    )
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">{thread.contact}</h2>
      <ul className="flex flex-col gap-2">
        {thread.messages.map((m, i) => (
          <li
            key={i}
            className={`max-w-[80%] rounded-[14px] px-4 py-2 ${m.from === 'me' ? 'self-end border border-line bg-ink/15' : 'self-start bg-surface'}`}
          >
            {m.text}
          </li>
        ))}
      </ul>
    </div>
  )
}

function CalendarView({ ws }: { ws: Workspace }) {
  const events = [...ws.events].sort((a, b) => a.start.localeCompare(b.start))
  return (
    <ul className="flex flex-col gap-2">
      {events.map((e) => (
        <li key={e.id} className={row}>
          <span className="font-bold">{e.title}</span>
          <span className="block text-muted">{when(e.start, e.end)}</span>
        </li>
      ))}
    </ul>
  )
}

function NotesView({ ws }: { ws: Workspace }) {
  const note = ws.notes.find((n) => n.id === ws.view.open)
  if (note)
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">{note.title}</h2>
        <p className={`${row} whitespace-pre-wrap`}>{note.body}</p>
      </div>
    )
  return (
    <div className="flex flex-col gap-4">
      {ws.view.query && <h2 className="text-xl font-semibold">Notes with “{ws.view.query}”</h2>}
      <ul className="flex flex-col gap-2">
        {matchingNotes(ws).map((n) => (
          <li key={n.id} className={row}>
            {n.title}
          </li>
        ))}
      </ul>
      <h2 className="text-xl font-semibold">To-do</h2>
      <ul className="flex flex-col gap-2">
        {ws.todos.map((t) => (
          <li key={t.id} className={`${row} ${t.done ? 'text-muted line-through' : ''}`}>
            <span aria-label={t.done ? 'Done' : 'Not done'}>{t.done ? '✓' : '○'}</span> {t.text}
          </li>
        ))}
      </ul>
    </div>
  )
}

const VIEWS = { mail: MailView, messages: MessagesView, calendar: CalendarView, notes: NotesView }

export function WorkspaceView({ ws }: { ws: Workspace }) {
  const Body = VIEWS[ws.view.app]
  return (
    <section aria-label={APP_LABEL[ws.view.app]} className="flex flex-col gap-6 text-lg text-ink">
      <nav className="flex flex-wrap gap-x-6 gap-y-2 border-b border-line pb-3 text-lg">
        {APPS.map((a) => (
          <span key={a} className={a === ws.view.app ? 'text-ink underline' : 'text-muted'}>
            {APP_LABEL[a]}
          </span>
        ))}
      </nav>
      <div key={JSON.stringify(ws.view)} className="enter">
        <Body ws={ws} />
      </div>
    </section>
  )
}
