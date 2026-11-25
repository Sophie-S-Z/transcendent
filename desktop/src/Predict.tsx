// Predict mode: the window reads the controls of the foreground app, ranks them, and scans the top items.
// One held blink runs the highlighted item. The reader lists the valid controls. The ranker only orders that list.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { rankTier0 } from '../../src/core/actions'
import { toCsv } from '../../src/core/csv'
import type { BlinkConfig } from '../../src/input/blink'
import { useSignal } from '../../src/input/useSignal'
import { DONE, KEY_ROWS, typeKey } from '../../src/text/entry'
import { Card } from '../../src/ui/Card'
import { click } from '../../src/ui/click'
import { Ring } from '../../src/ui/Ring'
import { GROUPS, readProblem, signature, toActions, type AppAction, type AppWindow, type LogRow } from './predict'

type Layer =
  | { kind: 'home' }
  | { kind: 'groups' }
  | { kind: 'group'; name: string }
  | { kind: 'typing'; action: AppAction; text: string; row: number | null }
  | { kind: 'confirm'; action: AppAction; text?: string }
  | { kind: 'paused' }
type Item = { label: string; run: () => void }

const SHOWN = 4
const STEP_MS = 1200
const READ_MS = 1500
const PASSWORD_NOTICE = 'Transcendent does not type passwords. The cursor is in the field. Use Switch mode and the On-Screen Keyboard.'

const call = <T,>(cmd: string, args?: Record<string, unknown>) =>
  window.__TAURI__ ? (window.__TAURI__.core.invoke(cmd, args) as Promise<T>) : Promise.reject('No desktop app.')

/** A value in localStorage. Storage errors only lose the value. */
function useLocal<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? 'null') ?? initial
    } catch {
      return initial
    }
  })
  const save = (v: T) => {
    setValue(v)
    try {
      localStorage.setItem(key, JSON.stringify(v))
    } catch {
      // The app keeps working without storage.
    }
  }
  return [value, save] as const
}

export function Predict({ blink }: { blink: BlinkConfig }) {
  const [win, setWin] = useState<AppWindow | null>(null)
  const [readError, setReadError] = useState('')
  const [notice, setNotice] = useState('')
  const [layer, setLayer] = useState<Layer>({ kind: 'home' })
  const [index, setIndex] = useState(0)
  const [version, setVersion] = useState(0)
  const [reads, setReads] = useState(0)
  const [glow, setGlow] = useState(false)
  const [sure, setSure] = useState(false)
  const [allCounts, setAllCounts] = useLocal<Record<string, Record<string, number>>>('transcendent.counts', {})
  const [log, setLog] = useLocal<LogRow[]>('transcendent.log', [])
  const app = win?.process ?? ''
  const counts = useMemo(() => allCounts[app] ?? {}, [allCounts, app])
  const actions = useMemo(() => toActions(win?.controls ?? []), [win])
  const ranked = useMemo(() => rankTier0(actions, counts), [actions, counts])
  const shown = useRef('')

  const go = (next: Layer) => {
    setLayer(next)
    setIndex(0)
    setVersion((v) => v + 1)
  }
  const home = () => go({ kind: 'home' })
  const stop = () => go({ kind: 'paused' })

  // A new list restarts the scan. Text entry stays while its field is still in the window.
  const onRead = (w: AppWindow) => {
    setWin(w)
    setReadError(readProblem(w))
    const sig = signature(w.controls)
    if (sig === shown.current) return
    shown.current = sig
    const keep = layer.kind === 'typing' && w.controls.some((c) => c.id === layer.action.id)
    if (layer.kind !== 'paused' && !keep) home()
  }
  const onReadRef = useRef(onRead)
  useEffect(() => {
    onReadRef.current = onRead
  })

  // Reads the window at the start, every 1.5 s, and after each action. The confirm screen stops the reads.
  const confirming = layer.kind === 'confirm'
  useEffect(() => {
    if (confirming) return
    let live = true
    const read = () =>
      call<AppWindow>('read_window').then(
        (w) => live && onReadRef.current(w),
        (e) => {
          if (!live) return
          shown.current = ''
          setWin(null)
          setReadError(String(e))
        },
      )
    read()
    const id = setInterval(read, READ_MS)
    return () => {
      live = false
      clearInterval(id)
    }
  }, [confirming, reads])

  const execute = (a: AppAction, text?: string) => {
    home()
    call('run_action', { id: a.id, kind: a.kind, label: a.name, text })
      .then(() => {
        setLog([...log, { time: new Date().toISOString(), app, label: a.label, risk: a.risk }])
        setAllCounts({ ...allCounts, [app]: { ...counts, [a.label]: (counts[a.label] ?? 0) + 1 } })
        if (a.password) setNotice(PASSWORD_NOTICE)
      })
      .catch((e: unknown) => setNotice(String(e)))
      .finally(() => setReads((n) => n + 1))
  }

  const pick = (a: AppAction) => {
    if (a.kind === 'type') go({ kind: 'typing', action: a, text: '', row: null })
    else if (a.risk === 'irreversible') go({ kind: 'confirm', action: a })
    else execute(a)
  }
  const toItem = (a: AppAction): Item => ({ label: a.label, run: () => pick(a) })

  const items: Item[] = (() => {
    switch (layer.kind) {
      case 'home':
        return [
          ...ranked.slice(0, SHOWN).map(toItem),
          { label: 'Something else', run: () => go({ kind: 'groups' }) },
          { label: 'Stop', run: stop },
        ]
      case 'groups':
        return [
          ...GROUPS.filter(([, test]) => actions.some(test)).map(([name]) => ({ label: name, run: () => go({ kind: 'group', name }) })),
          { label: 'Back', run: home },
        ]
      case 'group': {
        const test = GROUPS.find(([n]) => n === layer.name)![1]
        return [...actions.filter(test).map(toItem), { label: 'Back', run: () => go({ kind: 'groups' }) }]
      }
      case 'typing': {
        const { action, text } = layer
        const type = (next: string) => go({ ...layer, text: next, row: null })
        const finish = () => text.trim() && (action.risk === 'irreversible' ? go({ kind: 'confirm', action, text }) : execute(action, text))
        if (layer.row !== null) return KEY_ROWS[layer.row].map((k) => ({ label: k, run: () => (k === DONE ? finish() : type(typeKey(text, k))) }))
        return [...KEY_ROWS.map((r, i) => ({ label: r.join(' '), run: () => go({ ...layer, row: i }) })), { label: 'Cancel', run: home }]
      }
      case 'confirm':
        // Cancel is first, so a fast double signal cannot confirm.
        return [
          { label: 'Cancel', run: home },
          { label: `Confirm: ${layer.action.label}`, run: () => execute(layer.action, layer.text) },
        ]
      case 'paused':
        return [{ label: 'Start again', run: home }]
    }
  })()

  const onSelect = () => {
    const item = items[index]
    if (!item) return
    click()
    setNotice('')
    setGlow(true)
    setTimeout(() => setGlow(false), 250)
    item.run()
  }
  const stopRef = useRef(stop)
  useEffect(() => {
    stopRef.current = stop
  })

  // A held blink selects when the eyes open. A hold of 3 seconds stops the scan and selects nothing.
  const { videoRef, progress, paused, status, error } = useSignal(onSelect, blink, true, () => stopRef.current())

  // The highlight moves every 1.2 s. In a keyboard row, one full pass returns to the row list.
  const scan = useRef({ index, count: items.length, layer })
  useEffect(() => {
    scan.current = { index, count: items.length, layer }
  })
  const stopped = layer.kind === 'paused' || paused
  useEffect(() => {
    if (stopped) return
    const id = setInterval(() => {
      const { index: i, count, layer: l } = scan.current
      if (i + 1 >= count && l.kind === 'typing' && l.row !== null) go({ ...l, row: null })
      else setIndex((i + 1) % count)
    }, STEP_MS)
    return () => clearInterval(id)
  }, [version, stopped])

  const exportCsv = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([toCsv(['time', 'app', 'label', 'risk'], log.map((r) => [r.time, r.app, r.label, r.risk]))], { type: 'text/csv' }))
    a.download = 'transcendent-log.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const title = {
    home: 'Next action',
    groups: 'Something else',
    group: layer.kind === 'group' ? layer.name : '',
    typing: layer.kind === 'typing' ? layer.action.label : '',
    confirm: 'Confirm',
    paused: 'Stopped. Select to start again',
  }[layer.kind]
  const ready = !!win?.controls.length || layer.kind === 'paused'

  return (
    <>
      <div className="flex items-center gap-3 text-sm text-muted">
        {status !== 'error' && <video ref={videoRef} muted playsInline className="h-12 w-16 -scale-x-100 rounded-[8px] bg-surface object-cover" />}
        <span className="min-w-0 flex-1 truncate">
          {status === 'error' ? `The camera did not start: ${error}` : status === 'loading' ? 'Starting the camera.' : win ? `${win.title} · ${win.process}` : 'Reading the app'}
        </span>
        {layer.kind === 'paused' && <Ring progress={progress} size={48} />}
      </div>
      {(readError || notice) && (
        <p role="status" className="leading-snug">
          {notice || readError}
        </p>
      )}
      <h2 className="text-muted">{title}</h2>
      {layer.kind === 'typing' && (
        <p className="min-h-12 rounded-[14px] border border-line bg-bg/60 px-4 py-2 font-mono text-lg break-words">{layer.text || ' '}▌</p>
      )}
      {layer.kind === 'confirm' && layer.text && <p className="text-lg">“{layer.text}”</p>}
      <div className={`min-h-0 flex-1 overflow-y-auto ${layer.kind === 'typing' && layer.row !== null ? 'grid auto-rows-min grid-cols-3 gap-2' : 'flex flex-col gap-2'}`}>
        {(ready ? items : []).map((it, i) => (
          <div
            key={`${version}-${i}`}
            ref={i === index ? (el) => el?.scrollIntoView({ block: 'nearest' }) : undefined}
            className="enter"
            style={{ '--i': i } as CSSProperties}
          >
            <Card compact label={it.label} highlight={i === index} progress={progress} />
          </div>
        ))}
      </div>
      {layer.kind === 'paused' && (
        <div className="flex items-center gap-2 text-sm">
          <span className="flex-1 text-muted">Log on this computer: {log.length} actions</span>
          <button className="btn btn-ghost min-h-10 px-3 text-sm" disabled={!log.length} onClick={exportCsv}>
            Export CSV
          </button>
          <button
            className="btn btn-ghost min-h-10 px-3 text-sm"
            disabled={!log.length}
            onClick={() => {
              if (sure) setLog([])
              setSure(!sure)
            }}
          >
            {sure ? 'Click again to delete' : 'Delete log'}
          </button>
        </div>
      )}
      {glow && <div aria-hidden className="pulse pointer-events-none fixed inset-0" />}
      {paused && (
        <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-bg/95 p-6 text-center">
          <p className="text-3xl font-semibold tracking-tight">Paused</p>
          <p className="text-lg">The camera does not see your face. Return to the camera and hold a blink.</p>
        </div>
      )}
    </>
  )
}
