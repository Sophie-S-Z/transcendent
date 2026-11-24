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
  const button = 'min-h-24 rounded-xl bg-accent px-8 font-bold text-bg disabled:opacity-50'

  return (
    <main className="flex min-h-screen flex-col gap-6 bg-bg p-8 text-ink">
      <h1 className="text-2xl font-bold">Tier 1 timing probe</h1>
      <p>Model: {MODEL_ID}</p>
      <p>WebGPU: {'gpu' in navigator ? 'yes' : 'no'}</p>
      <button className={button} disabled={busy || !!engine} onClick={load}>
        Load model
      </button>
      {progress && <p className="text-muted">{progress}</p>}
      {loadMs !== undefined && <p>Load time: {Math.round(loadMs)} ms</p>}
      <button className={button} disabled={busy || !engine} onClick={time}>
        Time 5 ranking prompts
      </button>
      {times.length > 0 && (
        <ol className="list-decimal rounded-xl bg-surface p-6 pl-12">
          {times.map((t, i) => (
            <li key={i}>{Math.round(t)} ms</li>
          ))}
        </ol>
      )}
      {med !== undefined && (
        <>
          <p>Median: {Math.round(med)} ms</p>
          <p className={`text-6xl font-bold ${med <= LIMIT_MS ? 'text-accent' : 'text-ink'}`}>
            {med <= LIMIT_MS ? 'PASS' : 'FAIL'}
          </p>
        </>
      )}
      {labels.length > 0 && (
        <section className="rounded-xl bg-surface p-6">
          <h2 className="font-bold">First ranking (inbox)</h2>
          <ol className="list-decimal pl-8">
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
