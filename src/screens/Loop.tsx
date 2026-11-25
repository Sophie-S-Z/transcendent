// The home loop: the one-signal interface (T7 to T13).
// A highlight moves through a list of items. One select runs the highlighted item.
import { useEffect, useMemo, useRef, useState } from 'react'
import { countKey, rankActions, type Counts } from '../core/predict'
import { sampleWorkspace } from '../core/sample'
import { loadEngine, rankWithModel, type Engine } from '../core/tier1'
import { applyAction, helpAction, validActions, type Action, type Workspace } from '../core/workspace'
import { loadLog, saveLog } from '../eval/log'
import { HELP_TESTS, TASKS, type Task } from '../eval/tasks'
import { useSignal } from '../input/useSignal'
import type { Settings } from '../settings'
import { acceptWord, DONE, draftsFor, KEY_ROWS, nextWords, typeKey } from '../text/entry'
import { Card } from '../ui/Card'
import { click } from '../ui/click'
import { WorkspaceView } from './WorkspaceView'

type Layer =
  | { kind: 'home' }
  | { kind: 'categories' }
  | { kind: 'actions'; category: string }
  | { kind: 'drafts'; action: Action }
  | { kind: 'typing'; action: Action; text: string; row: number | null }
  | { kind: 'confirm'; action: Action; text?: string }

type Item = { label: string; run: () => void }

type Trial = {
  task: Task
  t0: number
  startedAt: string
  signals: number
  errors: number
  steps: number
  topHits: number
  top5Hits: number
  end?: { ms: number; completed: boolean }
}

const UNDO_MS = 5000
const MODEL_WAIT_MS = 1500
const SHOWN = 4 // predicted cards. "Something else" is the fifth.

// "Something else" groups every valid action. Help has its own item in every cycle.
const CATEGORIES: [string, (a: Action) => boolean][] = [
  ['Open an item', (a) => a.verb === 'open'],
  ['Write or reply', (a) => a.needsText],
  ['Change this item', (a) => !['open', 'go', 'delete', 'help'].includes(a.verb) && !a.needsText],
  ['Go to an app', (a) => a.verb === 'go'],
  ['Delete', (a) => a.verb === 'delete'],
]
const inCategory = (ws: Workspace, name: string) => validActions(ws).filter(CATEGORIES.find(([n]) => n === name)![1])

/** Tier 1 order first, then the Tier 0 order for the rest. */
const merge = (ids: string[], tier0: Action[]) => [
  ...ids.flatMap((id) => tier0.find((a) => a.id === id) ?? []),
  ...tier0.filter((a) => !ids.includes(a.id)),
]

export function Loop({ settings, session, onExit }: { settings: Settings; session: boolean; onExit: () => void }) {
  const { mode, stepMs } = settings
  const baseline = mode === 'baseline'
  const [ws, setWs] = useState(sampleWorkspace)
  const [layer, setLayer] = useState<Layer>({ kind: 'home' })
  const [index, setIndex] = useState(0)
  const [version, setVersion] = useState(0)
  const [history, setHistory] = useState<Workspace[]>([])
  const [undo, setUndo] = useState<string | null>(null)
  const [glow, setGlow] = useState(false)
  const [trial, setTrial] = useState<Trial | null>(null)
  const [holdout, setHoldout] = useState('')
  const [counts, setCounts] = useState<Counts>({})

  // The scan timer and async callbacks read the current screen from this ref.
  const scan = useRef({ index, count: 0, layer })
  // Tier 1 loads while the user works. Until it is ready, Tier 0 ranks (T16).
  const [engine, setEngine] = useState<Engine | null>(null)
  const [modelStatus, setModelStatus] = useState('')
  useEffect(() => {
    if (mode !== 'tier1') return
    let live = true
    loadEngine((text) => live && setModelStatus(text))
      .then((e) => live && setEngine(e))
      .catch((e: unknown) => live && setModelStatus(`Model error, Tier 0 ranks: ${String(e)}`))
    return () => {
      live = false
    }
  }, [mode])

  const tier0 = useMemo(() => rankActions(ws, counts), [ws, counts])
  const [model, setModel] = useState<{ ws: Workspace; ids: string[] } | null>(null)
  useEffect(() => {
    if (!engine) return
    let live = true
    let pending = true
    let timer = 0
    // After 1.5 s the model stops, and Tier 0 ranks. The scan starts again on the first card.
    const timeout = new Promise<null>((resolve) => {
      timer = window.setTimeout(() => resolve(null), MODEL_WAIT_MS)
    })
    Promise.race([rankWithModel(engine, ws, tier0), timeout])
      .catch(() => [])
      .then((ids) => {
        if (ids === null) engine.interruptGenerate()
        pending = false
        clearTimeout(timer)
        if (!live) return
        setModel({ ws, ids: ids ?? [] })
        if (scan.current.layer.kind === 'home') {
          setIndex(0)
          setVersion((v) => v + 1)
        }
      })
    return () => {
      live = false
      clearTimeout(timer)
      if (pending) engine.interruptGenerate()
      pending = false
    }
  }, [engine, ws, tier0])
  const ranked = engine ? (model?.ws === ws ? merge(model.ids, tier0) : null) : tier0
  const thinking = ranked === null

  const go = (next: Layer) => {
    setLayer(next)
    setIndex(0)
    setVersion((v) => v + 1)
  }
  const home = () => go({ kind: 'home' })
  type Counter = 'signals' | 'errors' | 'steps' | 'topHits' | 'top5Hits'
  const addToTrial = (change: Partial<Record<Counter, number>>) =>
    setTrial((t) => {
      if (!t || t.end) return t
      const next = { ...t }
      for (const [k, v] of Object.entries(change)) next[k as Counter] += v
      return next
    })

  const endTrial = (completed: boolean, when: (t: Trial) => boolean = () => true) =>
    setTrial((t) => (t && !t.end && when(t) ? { ...t, end: { ms: Math.round(performance.now() - t.t0), completed } } : t))

  // Each ended trial goes to the session log one time.
  const saved = useRef<Trial | null>(null)
  useEffect(() => {
    if (!trial?.end || saved.current === trial) return
    saved.current = trial
    const { task, end, t0: _, ...counters } = trial
    saveLog([...loadLog(), { session: SESSION, tester: settings.tester, mode, task: task.id, ...counters, ...end }])
  }, [trial, mode, settings.tester])

  const run = (a: Action, text?: string) => {
    const next = applyAction(ws, { id: a.id, text })
    setCounts((c) => ({ ...c, [countKey(a)]: (c[countKey(a)] ?? 0) + 1 }))
    if (a.reversible) {
      setHistory((h) => [...h, ws])
      setUndo(a.label)
    } else setUndo(null)
    setWs(next)
    home()
    endTrial(true, (t) => t.task.done(next))
  }

  const withText = (a: Action, text: string) => (a.reversible ? run(a, text) : go({ kind: 'confirm', action: a, text }))

  const pick = (a: Action) => {
    if (a !== helpAction && ranked && !baseline) {
      const rank = ranked.findIndex((r) => r.id === a.id)
      addToTrial({ steps: 1, topHits: rank === 0 ? 1 : 0, top5Hits: rank >= 0 && rank < SHOWN ? 1 : 0 })
    }
    if (a.needsText) {
      const drafts = baseline ? [] : draftsFor(ws, a)
      go(drafts.length ? { kind: 'drafts', action: a } : { kind: 'typing', action: a, text: '', row: null })
    } else if (!a.reversible) go({ kind: 'confirm', action: a })
    else run(a)
  }

  const cancel = () => {
    addToTrial({ errors: 1 })
    home()
  }

  // The Undo bar stays for 5 seconds after each reversible action (T10).
  useEffect(() => {
    if (!undo) return
    // The Undo item is first on the home screen. When it goes, the highlight stays on the same item.
    const id = setTimeout(() => {
      setUndo(null)
      if (scan.current.layer.kind === 'home') setIndex((i) => Math.max(0, i - 1))
    }, UNDO_MS)
    return () => clearTimeout(id)
  }, [undo, history])

  const doUndo = () => {
    setWs(history.at(-1)!)
    setHistory((h) => h.slice(0, -1))
    setUndo(null)
    addToTrial({ errors: 1 })
    home()
  }

  const categoryItems: Item[] = CATEGORIES.filter(([name]) => inCategory(ws, name).length).map(([name]) => ({
    label: name,
    run: () => go({ kind: 'actions', category: name }),
  }))
  const helpItem: Item = { label: 'Call for help', run: () => pick(helpAction) }

  const items: Item[] = (() => {
    switch (layer.kind) {
      case 'home':
        return [
          ...(undo ? [{ label: `Undo: ${undo}`, run: doUndo }] : []),
          ...(baseline
            ? categoryItems
            : [
                ...(ranked ?? []).slice(0, SHOWN).map((a) => ({ label: a.label, run: () => pick(a) })),
                { label: 'Something else', run: () => go({ kind: 'categories' }) },
              ]),
          helpItem,
        ]
      case 'categories':
        return [...categoryItems, helpItem, { label: 'Back', run: home }]
      case 'actions':
        return [
          ...inCategory(ws, layer.category).map((a) => ({ label: a.label, run: () => pick(a) })),
          { label: 'Back', run: baseline ? home : () => go({ kind: 'categories' }) },
        ]
      case 'drafts':
        return [
          ...draftsFor(ws, layer.action).map((d) => ({ label: d, run: () => withText(layer.action, d) })),
          { label: 'Write my own', run: () => go({ kind: 'typing', action: layer.action, text: '', row: null }) },
          { label: 'Cancel', run: cancel },
        ]
      case 'typing': {
        const type = (text: string) => go({ ...layer, text, row: null })
        if (layer.row !== null)
          return KEY_ROWS[layer.row].map((k) => ({
            label: k,
            run: () => (k === DONE ? layer.text.trim() && withText(layer.action, layer.text) : type(typeKey(layer.text, k))),
          }))
        return [
          ...(baseline ? [] : nextWords(layer.text, ws).map((w) => ({ label: w, run: () => type(acceptWord(layer.text, w)) }))),
          ...KEY_ROWS.map((row, i) => ({ label: row.join(' '), run: () => go({ ...layer, row: i }) })),
          { label: 'Cancel', run: cancel },
        ]
      }
      case 'confirm':
        // Cancel is first, so a fast double signal cannot confirm (T9).
        return [
          { label: 'Cancel', run: cancel },
          { label: `Confirm: ${layer.action.label}`, run: () => run(layer.action, layer.text) },
        ]
    }
  })()

  const onSelect = () => {
    const item = items[index]
    if (!item) return
    if (settings.sound) click()
    addToTrial({ signals: 1 })
    setGlow(true)
    setTimeout(() => setGlow(false), 250)
    item.run()
  }

  const { videoRef, progress, paused, status, error } = useSignal(onSelect, settings.blink, settings.camera)

  // The highlight moves in rank order at the speed the user sets (T7).
  // In a keyboard row, one full pass with no select returns to the row list.
  useEffect(() => {
    scan.current = { index, count: items.length, layer }
  })
  useEffect(() => {
    if (paused) return
    const id = setInterval(() => {
      const { index: i, count, layer: l } = scan.current
      if (i + 1 >= count && l.kind === 'typing' && l.row !== null) go({ ...l, row: null })
      else setIndex((i + 1) % count)
    }, stepMs)
    return () => clearInterval(id)
  }, [version, paused, stepMs])

  const startTrial = (task: Task) => {
    setWs(task.start())
    setHistory([])
    setUndo(null)
    setCounts({})
    home()
    setTrial({ task, t0: performance.now(), startedAt: new Date().toISOString(), signals: 0, errors: 0, steps: 0, topHits: 0, top5Hits: 0 })
  }

  const title = {
    home: baseline ? 'Choose a group' : 'Next action',
    categories: 'Something else',
    actions: layer.kind === 'actions' ? layer.category : '',
    drafts: 'Choose a reply',
    typing: 'Write',
    confirm: 'Confirm',
  }[layer.kind]

  return (
    <main className="flex min-h-screen flex-col gap-4 p-6">
      <header className="flex flex-wrap items-center gap-6">
        <h1 className="text-2xl font-bold">Transcendent</h1>
        <span className="text-muted">{MODE_LABEL[mode]}</span>
        {modelStatus && !engine && <span className="max-w-md truncate text-muted">{modelStatus}</span>}
        {status === 'error' && <span>Camera error: {error}. Use any key.</span>}
        <div className="ml-auto flex items-center gap-6">
          {trial && (
            <p className="font-mono text-6xl" aria-live="polite">
              {trial.signals} <span className="text-xl text-muted">signals</span>
            </p>
          )}
          {settings.camera && <video ref={videoRef} muted playsInline className="h-20 -scale-x-100 rounded-lg bg-surface" />}
          <button onClick={onExit} className="min-h-12 rounded-lg border-2 border-muted px-4 text-base text-muted">
            Exit
          </button>
        </div>
      </header>

      {session && (
        <Observer
          trial={trial}
          holdout={holdout}
          setHoldout={setHoldout}
          onStart={startTrial}
          onEnd={endTrial}
        />
      )}

      <div className="grid flex-1 gap-8 lg:grid-cols-[1fr_2fr]">
        <section className="max-h-[70vh] overflow-auto">
          <WorkspaceView ws={ws} />
        </section>

        <section
          className={`flex flex-col gap-4 rounded-2xl px-2 transition-shadow duration-200 ${glow ? 'shadow-[0_0_48px_var(--color-accent)]' : ''}`}
        >
          <h2 className="text-xl text-muted">{thinking ? 'Thinking' : title}</h2>
          {layer.kind === 'typing' && (
            <p className="min-h-24 rounded-2xl border-2 border-ink p-4 font-mono text-3xl">{layer.text || ' '}▌</p>
          )}
          {layer.kind === 'confirm' && layer.text && <p className="text-2xl">"{layer.text}"</p>}
          {layer.kind === 'typing' && layer.row !== null ? (
            <div className="grid grid-cols-6 gap-4">
              {items.map((it, i) => (
                <Card key={it.label} label={it.label} highlight={i === index} progress={progress} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
              {items.map((it, i) => (
                <div key={`${version}-${i}`} className={i === 0 && layer.kind === 'home' && !baseline && !undo ? 'col-span-full' : ''}>
                  <Card
                    label={it.label}
                    large={i === 0 && layer.kind === 'home' && !baseline && !undo}
                    highlight={i === index}
                    progress={progress}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {paused && (
        <div className="fixed inset-0 flex flex-col items-center justify-center gap-6 bg-bg/95 p-8 text-center">
          <p className="text-5xl font-bold">Paused</p>
          <p className="text-2xl">The camera does not see your face. Press any key, or return to the camera and hold a blink.</p>
        </div>
      )}
    </main>
  )
}

const SESSION = Date.now().toString(36)
const MODE_LABEL = { baseline: 'Baseline keyboard', tier0: 'Tier 0 rules', tier1: 'Tier 1 model' }

/** The observer panel. The observer uses the mouse. These clicks are not signals. */
function Observer({
  trial,
  holdout,
  setHoldout,
  onStart,
  onEnd,
}: {
  trial: Trial | null
  holdout: string
  setHoldout: (s: string) => void
  onStart: (t: Task) => void
  onEnd: (completed: boolean) => void
}) {
  const button = 'min-h-12 rounded-lg border-2 border-muted px-4 text-base'
  if (trial && !trial.end)
    return (
      <section className="flex flex-wrap items-center gap-4 rounded-2xl bg-surface px-4 py-2">
        <p className="text-xl">Task: {trial.task.instruction}</p>
        <button className={button} onClick={() => onEnd(true)}>
          Mark done
        </button>
        <button className={button} onClick={() => onEnd(false)}>
          Stop, not done
        </button>
      </section>
    )
  return (
    <section className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface p-4">
      {trial?.end && (
        <p className="w-full text-xl">
          {trial.task.title}: {trial.end.completed ? 'done' : 'not done'} in {trial.signals} signals and{' '}
          {(trial.end.ms / 1000).toFixed(1)} s
        </p>
      )}
      {[...TASKS, ...HELP_TESTS].map((t) => (
        <button key={t.id} className={button} onClick={() => onStart(t)} title={t.instruction}>
          {typeof t.id === 'number' ? `Task ${t.id}` : t.title.replace('Call for help, state', 'Help')}
        </button>
      ))}
      <input
        value={holdout}
        onChange={(e) => setHoldout(e.target.value)}
        placeholder="Hold-out task"
        className="min-h-12 flex-1 rounded-lg bg-bg px-4 text-base"
      />
      <button
        className={button}
        disabled={!holdout.trim()}
        onClick={() =>
          onStart({ id: `holdout: ${holdout.trim()}`, title: holdout.trim(), instruction: holdout.trim(), start: sampleWorkspace, done: () => false })
        }
      >
        Start hold-out
      </button>
    </section>
  )
}
