// The results screen for the observer and the judges (T15). It shows signals and time next to the baseline.
import { Fragment } from 'react'
import { median, MODE_LABEL, savingPct, summarize, toCsv, type Mode, type TaskRecord } from '../eval/log'
import { SCENARIOS } from '../eval/scenarios'
import { TASKS } from '../eval/tasks'

const ORDER: Mode[] = ['baseline', 'tier0', 'tier1']

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
  // One row for each scenario and task, grouped in scenario order. Records without a scenario belong to 'eval'.
  const scenarioOf = (r: TaskRecord) => r.scenario ?? 'eval'
  const rows: { scenario: string; id: number | string }[] = TASKS.map((t) => ({ scenario: 'eval', id: t.id }))
  for (const r of done)
    if (!rows.some((x) => x.scenario === scenarioOf(r) && x.id === r.task)) rows.push({ scenario: scenarioOf(r), id: r.task })
  // An unknown scenario goes last.
  const order = (s: string) => {
    const i = SCENARIOS.findIndex((x) => x.id === s)
    return i < 0 ? SCENARIOS.length : i
  }
  rows.sort((a, b) => order(a.scenario) - order(b.scenario))
  const scenarioName = (s: string) => SCENARIOS.find((x) => x.id === s)?.name ?? s
  const title = (id: number | string) =>
    id === 'gate-a' ? 'Gate A reading test' : (SCENARIOS.flatMap((s) => s.tasks).find((t) => t.id === id)?.title ?? String(id))
  const cell = (scenario: string, id: number | string, mode: Mode) => {
    const xs = done.filter((r) => scenarioOf(r) === scenario && r.task === id && r.mode === mode).map((r) => r.signals)
    return xs.length ? String(median(xs)) : '-'
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-10 px-10 py-10">
      <header className="flex flex-wrap items-center gap-4 border-b border-line pb-5">
        <h1 className="mr-auto text-3xl font-bold">Results</h1>
        <button type="button" onClick={() => exportCsv(records)} className="btn lit px-6 text-lg">
          Export CSV
        </button>
        <button type="button" onClick={onClose} className="btn btn-ghost px-6 text-lg">
          Close
        </button>
      </header>

      {summaries.length === 0 ? (
        <p className="text-xl">No completed tasks yet. Run a session first.</p>
      ) : (
        <>
          <section className="grid gap-10 md:grid-cols-3 md:gap-0 md:divide-x md:divide-line">
            {summaries.map((s) => (
              <article key={s.mode} className="flex flex-col gap-4 md:px-8 md:first:pl-0 md:last:pr-0">
                <div>
                  <h2 className="text-xl font-bold">{MODE_LABEL[s.mode]}</h2>
                  <p className="text-muted">{s.tasks} tasks</p>
                </div>
                <div>
                  <p className="font-mono text-5xl font-bold">{s.medianSignals}</p>
                  <p>median signals per task</p>
                  <p className="text-muted">
                    range <span className="font-mono">{s.minSignals}</span> to <span className="font-mono">{s.maxSignals}</span>
                  </p>
                </div>
                <div>
                  <p className="font-mono text-3xl font-bold">{(s.medianMs / 1000).toFixed(1)} s</p>
                  <p>median time</p>
                </div>
                {s.mode !== 'baseline' && (
                  <div className="flex flex-col gap-1 border-t border-line pt-4">
                    {baseline && (
                      <p className="font-bold">
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

          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                <th className="py-3 pr-6 font-normal text-muted">Task</th>
                {summaries.map((s) => (
                  <th key={s.mode} className="py-3 pr-6 font-normal text-muted">
                    {MODE_LABEL[s.mode]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ scenario, id }, i) => (
                <Fragment key={`${scenario}/${id}`}>
                  {scenario !== rows[i - 1]?.scenario && (
                    <tr className="border-b border-line">
                      <th colSpan={summaries.length + 1} className="pt-6 pb-2 text-sm font-normal text-muted">
                        {scenarioName(scenario)}
                      </th>
                    </tr>
                  )}
                  <tr className="border-b border-line">
                    <td className="py-2.5 pr-6">
                      {typeof id === 'number' ? `${id}. ` : ''}
                      {title(id)}
                    </td>
                    {summaries.map((s) => (
                      <td key={s.mode} className="py-2.5 pr-6 font-mono">
                        {cell(scenario, id, s.mode)}
                      </td>
                    ))}
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </>
      )}

      <p className="text-muted">Report the real numbers. With fewer than 5 testers, make no statistical claim.</p>
    </main>
  )
}
