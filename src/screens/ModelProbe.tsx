// The Tier 1 timing probe (the PRD 30-minute test). Run it one time on the user's laptop.
// Tier 1 stays in the plan only when the median ranking time is 1500 ms or less.

import { useState } from 'react'
import { rankActions } from '../core/predict'
import { sampleWorkspace } from '../core/sample'
import { loadEngine, MODEL_ID, rankWithModel, type Engine } from '../core/tier1'
import { applyAction, validActions, type Workspace } from '../core/workspace'

const LIMIT_MS = 1500

function states(): Workspace[] {
  const inbox = sampleWorkspace()
  const invite = applyAction(inbox, { id: 'open:mail-lunch' })
  const notes = applyAction(inbox, { id: 'go:notes' })
  return [inbox, invite, notes, inbox, invite]
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]

export function ModelProbe() {
  const [engine, setEngine] = useState<Engine>()
  const [progress, setProgress] = useState('')
  const [loadMs, setLoadMs] = useState<number>()
  const [times, setTimes] = useState<number[]>([])
  const [labels, setLabels] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setBusy(true)
    setError('')
    const start = performance.now()
    try {
      setEngine(await loadEngine(setProgress))
      setLoadMs(performance.now() - start)
    } catch (e) {
      setError(String(e))
    }
    setBusy(false)
  }

  async function time() {
    if (!engine) return
    setBusy(true)
    setError('')
    setTimes([])
    try {
      const out: number[] = []
      for (const [i, ws] of states().entries()) {
        const start = performance.now()
        const ids = await rankWithModel(engine, ws, rankActions(ws, {}))
        out.push(performance.now() - start)
        setTimes([...out])
        if (i === 0) setLabels(ids.map((id) => validActions(ws).find((a) => a.id === id)?.label ?? id))
      }
    } catch (e) {
      setError(String(e))
    }
    setBusy(false)
  }

  const med = times.length === 5 ? median(times) : undefined
  const button = 'btn lit px-6 text-lg'

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-10 py-10">
      <header className="flex flex-col gap-2 border-b border-line pb-5">
        <h1 className="text-3xl font-bold">Tier 1 timing probe</h1>
        <p className="text-muted">Model: {MODEL_ID}</p>
        <p className="text-muted">WebGPU: {'gpu' in navigator ? 'yes' : 'no'}</p>
      </header>
      <section className="flex flex-col items-start gap-4">
        <button className={button} disabled={busy || !!engine} onClick={load}>
          Load model
        </button>
        {progress && <p className="text-muted">{progress}</p>}
        {loadMs !== undefined && (
          <p>
            Load time: <span className="font-mono">{Math.round(loadMs)}</span> ms
          </p>
        )}
      </section>
      <section className="flex flex-col items-start gap-4">
        <button className={button} disabled={busy || !engine} onClick={time}>
          Time 5 ranking prompts
        </button>
        {times.length > 0 && (
          <ol className="flex list-decimal flex-col gap-1 pl-6 font-mono">
            {times.map((t, i) => (
              <li key={i}>{Math.round(t)} ms</li>
            ))}
          </ol>
        )}
        {med !== undefined && (
          <div className="flex items-baseline gap-6 border-t border-line pt-4 self-stretch">
            <p>
              Median: <span className="font-mono">{Math.round(med)}</span> ms
            </p>
            <p className={`text-4xl font-bold ${med <= LIMIT_MS ? 'text-ink' : 'text-accent'}`}>
              {med <= LIMIT_MS ? 'PASS' : 'FAIL'}
            </p>
          </div>
        )}
      </section>
      {labels.length > 0 && (
        <section className="flex flex-col gap-3 border-t border-line pt-5">
          <h2 className="font-bold">First ranking (inbox)</h2>
          <ol className="flex list-decimal flex-col gap-1 pl-6">
            {labels.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ol>
        </section>
      )}
      {error && <p className="text-accent">{error}</p>}
    </main>
  )
}
