// The results screen for the observer and the judges (T15). It shows signals and time next to the baseline.
import { median, savingPct, summarize, toCsv, type Mode, type TaskRecord } from '../eval/log'
import { TASKS } from '../eval/tasks'

const ORDER: Mode[] = ['baseline', 'tier0', 'tier1']
const LABELS: Record<Mode, string> = {
  baseline: 'Baseline keyboard',
  tier0: 'Tier 0 rules',
  tier1: 'Tier 1 model',
}

const pct = (x: number) => `${Math.round(x * 100)}%`

/** Starts a download of the CSV log. */
function exportCsv(records: TaskRecord[]) {
  const url = URL.createObjectURL(new Blob([toCsv(records)], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'transcendent-log.csv'
  document.body.append(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function Results({ records, onClose }: { records: TaskRecord[]; onClose: () => void }) {
  const summaries = summarize(records).sort((a, b) => ORDER.indexOf(a.mode) - ORDER.indexOf(b.mode))
  const baseline = summaries.find((s) => s.mode === 'baseline')
  const done = records.filter((r) => r.completed)
  const ids: (number | string)[] = TASKS.map((t) => t.id)
  for (const r of done) if (!ids.includes(r.task)) ids.push(r.task)
  const title = (id: number | string) => TASKS.find((t) => t.id === id)?.title ?? String(id)
  const cell = (id: number | string, mode: Mode) => {
    const xs = done.filter((r) => r.task === id && r.mode === mode).map((r) => r.signals)
    return xs.length ? String(median(xs)) : '-'
  }

  return (
    <main className="min-h-screen bg-bg p-8 text-base text-ink">
      <header className="mb-8 flex flex-wrap items-center gap-4">
        <h1 className="mr-auto text-4xl font-bold">Results</h1>
        <button
          type="button"
          onClick={() => exportCsv(records)}
          className="min-h-24 rounded-2xl bg-accent px-8 text-xl font-bold text-bg"
        >
          Export CSV
        </button>
        <button
          type="button"
          onClick={onClose}
          className="min-h-24 rounded-2xl border-4 border-ink px-8 text-xl font-bold text-ink"
        >
          Close
        </button>
      </header>

      {summaries.length === 0 ? (
        <p className="text-2xl">No completed tasks yet. Run a session first.</p>
      ) : (
        <>
          <section className="mb-8 grid gap-4 md:grid-cols-3">
            {summaries.map((s) => (
              <article key={s.mode} className="rounded-2xl bg-surface p-8">
                <h2 className="text-2xl font-bold">{LABELS[s.mode]}</h2>
                <p className="text-muted">{s.tasks} tasks</p>
                <p className="mt-4 font-mono text-8xl font-bold">{s.medianSignals}</p>
                <p>median signals per task</p>
                <p className="mt-2 font-mono">
                  range {s.minSignals} to {s.maxSignals}
                </p>
                <p className="mt-4 font-mono text-6xl font-bold">{(s.medianMs / 1000).toFixed(1)} s</p>
                <p>median time</p>
                {s.mode !== 'baseline' && (
                  <div className="mt-4 flex flex-col gap-2">
                    {baseline && (
                      <p className="text-xl font-bold">
                        {savingPct(baseline.medianSignals, s.medianSignals)}% fewer signals than baseline
                      </p>
                    )}
                    <p>
                      Top action correct: <span className="font-mono">{pct(s.topRate)}</span>
                    </p>
                    <p>
                      On screen: <span className="font-mono">{pct(s.top5Rate)}</span>
                    </p>
                  </div>
                )}
              </article>
            ))}
          </section>

          <table className="mb-8 w-full border-collapse text-left">
            <thead>
              <tr className="border-b-4 border-ink">
                <th className="p-2">Task</th>
                {summaries.map((s) => (
                  <th key={s.mode} className="p-2">
                    {LABELS[s.mode]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ids.map((id) => (
                <tr key={String(id)} className="border-b-2 border-surface">
                  <td className="p-2">
                    {typeof id === 'number' ? `${id}. ` : ''}
                    {title(id)}
                  </td>
                  {summaries.map((s) => (
                    <td key={s.mode} className="p-2 font-mono">
                      {cell(id, s.mode)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <p className="text-muted">Report the real numbers. With fewer than 5 testers, make no statistical claim.</p>
    </main>
  )
}
