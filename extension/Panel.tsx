/// <reference types="chrome" />
// The side panel: the consent screen and the one-signal scan loop for the open web page.
// The page reader lists the valid actions. The ranker only orders that list.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { rankTier0 } from '../src/core/actions'
import { toCsv } from '../src/core/csv'
import { loadEngine, rankList, type Engine } from '../src/core/tier1'
import { DEFAULT_CONFIG, type BlinkConfig } from '../src/input/blink'
import { useSignal } from '../src/input/useSignal'
import { STEP_MAX_MS, STEP_MIN_MS } from '../src/settings'
import { DONE, KEY_ROWS, typeKey } from '../src/text/entry'
import { Card } from '../src/ui/Card'
import { click } from '../src/ui/click'
import { Ring } from '../src/ui/Ring'
import type { FromPage, ToPage } from './content'
import {
  allowedWithPayments,
  appendLog,
  GROUPS,
  mergeRanking,
  PAYMENT_NOTICE,
  type LogRow,
  type PageAction,
  type PageState,
} from './page'

type Settings = { camera: boolean; stepMs: number; blink: BlinkConfig; model: boolean }
type Tab = { id: number; origin: string | null; nav: number }
type Layer =
  | { kind: 'home' }
  | { kind: 'groups' }
  | { kind: 'group'; name: string }
  | { kind: 'typing'; action: PageAction; text: string; row: number | null }
  | { kind: 'confirm'; action: PageAction; text?: string }
  | { kind: 'paused' }
type Item = { label: string; run: () => void; target?: string }

const DEFAULTS: Settings = { camera: true, stepMs: 1200, blink: DEFAULT_CONFIG, model: false }
const SHOWN = 4
const MODEL_WAIT_MS = 1500
// A short list keeps the model inside its 1.5 seconds.
const MODEL_LIST = 30
const NO_WEBGPU = 'This computer cannot run WebGPU, so the built-in ranker orders the actions.'
// The e2e test opens this page as a normal tab and names the page tab in the hash. Web pages cannot open it.
const FIXED_TAB = Number(new URLSearchParams(location.hash.slice(1)).get('tab')) || null

const originOf = (url?: string) => (url && /^https?:/.test(url) ? new URL(url).origin : null)
const hostOf = (origin: string) => new URL(origin).host
const pattern = (origin: string) => `${origin}/*`
/** A key for the list of actions on the page. A new key restarts the scan and asks the model again. */
const listOf = (s: PageState) => s.actions.map((a) => `${a.id}:${a.label}:${a.risk}`).join('|')

/** A value in chrome.storage.local. `ready` is false until the first read ends. */
function useStored<T>(key: string, initial: T) {
  const [value, setValue] = useState(initial)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    chrome.storage.local.get(key).then((r) => {
      if (r[key] !== undefined) setValue(r[key] as T)
      setReady(true)
    })
  }, [key])
  const save = (v: T) => {
    setValue(v)
    chrome.storage.local.set({ [key]: v })
  }
  return [value, save, ready] as const
}

/** The tab the panel works on: the active tab, or the tab named in the hash. `nav` changes on each page load. */
function useTab() {
  const [tab, setTab] = useState<Tab | null>(null)
  useEffect(() => {
    let nav = 0
    let current: number | undefined
    const load = async () => {
      const t = FIXED_TAB ? await chrome.tabs.get(FIXED_TAB) : (await chrome.tabs.query({ active: true, currentWindow: true }))[0]
      current = t?.id
      setTab(t?.id ? { id: t.id, origin: originOf(t.url), nav: nav++ } : null)
    }
    const onActivated = () => !FIXED_TAB && load()
    const onUpdated = (id: number, info: { status?: string }) => id === current && info.status === 'complete' && load()
    // A toolbar click grants activeTab, so the site name is known now.
    const onMessage = (m: { type?: string }) => m.type === 'action' && load()
    load()
    chrome.tabs.onActivated.addListener(onActivated)
    chrome.tabs.onUpdated.addListener(onUpdated)
    chrome.runtime.onMessage.addListener(onMessage)
    return () => {
      chrome.tabs.onActivated.removeListener(onActivated)
      chrome.tabs.onUpdated.removeListener(onUpdated)
      chrome.runtime.onMessage.removeListener(onMessage)
    }
  }, [])
  return tab
}

async function addLog(row: LogRow) {
  const { log = [] } = await chrome.storage.local.get('log')
  await chrome.storage.local.set({ log: appendLog(log as LogRow[], row) })
}

/** Tier 1: the on-device model loads in the background when the caregiver turns it on. Until it is ready, Tier 0 ranks. */
function useEngine(on: boolean) {
  const [engine, setEngine] = useState<Engine | null>(null)
  const [status, setStatus] = useState('')
  useEffect(() => {
    if (!on) return
    let live = true
    let loaded: Engine | null = null
    const load = async () => {
      // The download starts only when this computer has a WebGPU adapter.
      if (!(await navigator.gpu?.requestAdapter())) {
        if (live) setStatus(NO_WEBGPU)
        return
      }
      loaded = await loadEngine((text) => live && setStatus(text))
      if (live) setEngine(loaded)
      else loaded.unload()
    }
    load().catch((e: unknown) => live && setStatus(`The model did not load, so the built-in ranker orders the actions. ${String(e)}`))
    return () => {
      live = false
      loaded?.unload()
      setEngine(null)
      setStatus('')
    }
  }, [on])
  return { engine, status }
}

export function Panel() {
  const tab = useTab()
  const [sites, setSites, sitesReady] = useStored<string[]>('sites', [])
  const [stored, setSettings, settingsReady] = useStored('settings', DEFAULTS)
  // Settings saved by an older version miss the newer keys.
  const settings = { ...DEFAULTS, ...stored }
  const { engine, status } = useEngine(settingsReady && settings.model)
  const [granted, setGranted] = useState(false)
  const [view, setView] = useState<'scan' | 'setup'>('scan')
  const [cameraKey, setCameraKey] = useState(0)
  const origin = tab?.origin ?? null

  // A site is on only when it is on the list and Chrome still grants it.
  useEffect(() => {
    const check = () => {
      if (origin) chrome.permissions.contains({ origins: [pattern(origin)] }).then(setGranted)
      else setGranted(false)
    }
    check()
    chrome.permissions.onAdded.addListener(check)
    chrome.permissions.onRemoved.addListener(check)
    return () => {
      chrome.permissions.onAdded.removeListener(check)
      chrome.permissions.onRemoved.removeListener(check)
    }
  }, [origin])

  // The camera tab says when the camera is allowed. The scan then starts the camera again.
  useEffect(() => {
    const onMessage = (m: { type?: string }) => m.type === 'camera-ready' && setCameraKey((k) => k + 1)
    chrome.runtime.onMessage.addListener(onMessage)
    return () => chrome.runtime.onMessage.removeListener(onMessage)
  }, [])

  if (!sitesReady || !settingsReady) return null
  const allowed = !!origin && granted && sites.includes(origin)

  // Chrome needs the click itself to ask for the site, so the request comes first.
  const turnOn = (o: string) =>
    chrome.permissions.request({ origins: [pattern(o)] }).then((ok) => {
      if (!ok) return
      setSites([...new Set([...sites, o])])
      setView('scan')
    })
  const remove = (o: string) => {
    setSites(sites.filter((s) => s !== o))
    chrome.permissions.remove({ origins: [pattern(o)] }).catch(() => {})
  }

  return (
    <main className="flex min-h-dvh flex-col gap-5 px-4 py-4">
      <header className="flex items-center gap-3 border-b border-line pb-3">
        <h1 className="text-lg font-semibold tracking-tight">Transcendent</h1>
        <span className="min-w-0 flex-1 truncate text-muted">{origin ? hostOf(origin) : ''}</span>
        {allowed && (
          <button tabIndex={-1} className="btn btn-ghost min-h-10 px-4 text-base" onClick={() => setView(view === 'scan' ? 'setup' : 'scan')}>
            {view === 'scan' ? 'Settings' : 'Start'}
          </button>
        )}
      </header>
      {status && !engine && <p className="text-base text-muted">{status}</p>}
      {allowed && view === 'scan' && tab ? (
        <Scan key={cameraKey} tab={tab} origin={origin} settings={settings} engine={engine} />
      ) : (
        <Setup origin={origin} allowed={allowed} sites={sites} settings={settings} onSettings={setSettings} onTurnOn={turnOn} onRemove={remove} />
      )}
    </main>
  )
}

const row = 'flex min-h-14 items-center justify-between gap-4 py-2'

/** The consent screen for the caregiver. It uses the mouse. */
function Setup({
  origin,
  allowed,
  sites,
  settings,
  onSettings,
  onTurnOn,
  onRemove,
}: {
  origin: string | null
  allowed: boolean
  sites: string[]
  settings: Settings
  onSettings: (s: Settings) => void
  onTurnOn: (origin: string) => void
  onRemove: (origin: string) => void
}) {
  const [log, setLog] = useStored<LogRow[]>('log', [])
  const [sure, setSure] = useState(false)
  const set = (patch: Partial<Settings>) => onSettings({ ...settings, ...patch })
  const exportCsv = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([toCsv(['time', 'site', 'label', 'risk'], log.map((r) => [r.time, r.site, r.label, r.risk]))], { type: 'text/csv' }))
    a.download = 'transcendent-log.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }
  return (
    <div className="flex flex-col gap-8 text-lg">
      <section className="flex flex-col items-start gap-4">
        {!origin && <p>Open a web page, then click the Transcendent button in the toolbar.</p>}
        {origin && !allowed && (
          <>
            <p>Transcendent is off on {hostOf(origin)}. It reads a page only on a site that you turn on.</p>
            <button className="btn lit" onClick={() => onTurnOn(origin)}>
              Turn on {hostOf(origin)}
            </button>
          </>
        )}
        {origin && allowed && <p>Transcendent is on for {hostOf(origin)}. Press Start to use this page.</p>}
        <p className="text-base text-muted">The camera and the page stay on this laptop. Nothing is sent.</p>
      </section>

      <section className="flex flex-col divide-y divide-line">
        <h2 className="pb-2 text-sm text-muted">Sites that are on</h2>
        {sites.length === 0 && <p className="py-3 text-muted">No sites yet.</p>}
        {sites.map((s) => (
          <div key={s} className={row}>
            <span className="min-w-0 truncate">{hostOf(s)}</span>
            <button className="btn btn-ghost min-h-11 px-4 text-base" onClick={() => onRemove(s)}>
              Remove
            </button>
          </div>
        ))}
      </section>

      <section className="flex flex-col divide-y divide-line">
        <h2 className="pb-2 text-sm text-muted">Input</h2>
        <label className={row}>
          Use held blinks with the camera. Any key always works.
          <input type="checkbox" className="switch" checked={settings.camera} onChange={(e) => set({ camera: e.target.checked })} />
        </label>
        <label className="flex flex-col gap-3 py-3">
          Highlight speed: {(settings.stepMs / 1000).toFixed(1)} s
          <input
            type="range"
            min={STEP_MIN_MS}
            max={STEP_MAX_MS}
            step={100}
            value={settings.stepMs}
            onChange={(e) => set({ stepMs: Number(e.target.value) })}
            className="h-6"
          />
        </label>
        <p className="py-3 text-base text-muted">
          Hold time {settings.blink.holdMs} ms, threshold {settings.blink.threshold.toFixed(2)}. Calibrate in the web app. The
          extension keeps its own copy. A held blink of 3 seconds or the Escape key stops the scan.
        </p>
      </section>

      <section className="flex flex-col divide-y divide-line">
        <h2 className="pb-2 text-sm text-muted">Ranking</h2>
        <label className={row}>
          Rank with the on-device model (needs WebGPU, downloads about 400 MB once)
          <input type="checkbox" className="switch" checked={settings.model} onChange={(e) => set({ model: e.target.checked })} />
        </label>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm text-muted">Log on this laptop</h2>
        <p>{log.length} actions</p>
        <div className="flex flex-wrap gap-3">
          <button className="btn btn-ghost" disabled={!log.length} onClick={exportCsv}>
            Export CSV
          </button>
          <button
            className="btn btn-ghost"
            disabled={!log.length}
            onClick={() => {
              if (sure) setLog([])
              setSure(!sure)
            }}
          >
            {sure ? 'Click again to delete' : 'Delete log'}
          </button>
        </div>
      </section>
    </div>
  )
}

/** The scan loop on one allowed page. */
function Scan({ tab, origin, settings, engine }: { tab: Tab; origin: string | null; settings: Settings; engine: Engine | null }) {
  const site = origin ?? ''
  const [page, setPage] = useState<PageState | null>(null)
  const [layer, setLayer] = useState<Layer>({ kind: 'home' })
  const [index, setIndex] = useState(0)
  const [version, setVersion] = useState(0)
  const [notice, setNotice] = useState('')
  const [glow, setGlow] = useState(false)
  const [allCounts, setAllCounts] = useStored<Record<string, Record<string, number>>>('counts', {})
  const counts = useMemo(() => allCounts[site] ?? {}, [allCounts, site])
  const port = useRef<chrome.runtime.Port | null>(null)
  const pending = useRef<PageAction | null>(null)
  const signature = useRef('')
  // The action that the page runs next. An effect sends it, because render code does not touch the connection.
  const [request, setRequest] = useState<{ action: PageAction; text?: string; confirmed: boolean } | null>(null)

  const go = (next: Layer) => {
    setLayer(next)
    setIndex(0)
    setVersion((v) => v + 1)
  }
  const home = () => go({ kind: 'home' })
  // The highlight effect below removes the outline on the page.
  const stop = () => go({ kind: 'paused' })

  const actions = useMemo(() => (page ? page.actions.filter((a) => !page.payments || allowedWithPayments(a.kind)) : []), [page])
  const tier0 = useMemo(() => rankTier0(actions, counts), [actions, counts])
  // The model answer is for one list. Until it comes, the home screen shows no action cards.
  const [model, setModel] = useState<{ list: string; ids: string[] } | null>(null)
  const list = page ? listOf(page) : ''
  const ranked = engine ? (model?.list === list ? mergeRanking(model.ids, tier0) : null) : tier0

  const done = (a: PageAction) => {
    addLog({ time: new Date().toISOString(), site, label: a.label, risk: a.risk })
    setAllCounts({ ...allCounts, [site]: { ...counts, [a.label]: (counts[a.label] ?? 0) + 1 } })
  }

  const onPage = (m: FromPage) => {
    if (m.type === 'key') {
      // A key on the page counts like a key in the panel, so the no-face pause works the same way.
      if (m.key === 'stop') stop()
      else window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
    } else if (m.type === 'done') {
      const a = pending.current
      pending.current = null
      if (m.error) setNotice(m.error)
      else if (a) done(a)
    } else {
      setPage(m.state)
      const sig = listOf(m.state)
      if (sig === signature.current) return
      signature.current = sig
      // A new list restarts the scan. Text entry and the confirm screen stay while their item is still on the page.
      const keep = (layer.kind === 'typing' || layer.kind === 'confirm') && m.state.actions.some((a) => a.id === layer.action.id)
      if (layer.kind !== 'paused' && !keep) home()
    }
  }
  const onPageRef = useRef(onPage)
  useEffect(() => {
    onPageRef.current = onPage
  })

  // Injects the reader on each page load, and connects to it.
  useEffect(() => {
    let live = true
    chrome.scripting
      .executeScript({ target: { tabId: tab.id }, files: ['content.js'] })
      .then(() => {
        if (!live) return
        const p = chrome.tabs.connect(tab.id, { name: 'transcendent' })
        port.current = p
        p.onMessage.addListener((m: FromPage) => onPageRef.current(m))
        p.onDisconnect.addListener(() => {
          void chrome.runtime.lastError
          if (port.current === p) port.current = null
        })
        p.postMessage({ type: 'read' } satisfies ToPage)
      })
      .catch((e: unknown) => live && setNotice(`Transcendent cannot read this page. ${e instanceof Error ? e.message : ''}`))
    return () => {
      live = false
      port.current?.disconnect()
      port.current = null
    }
  }, [tab.id, tab.nav])

  const execute = (a: PageAction, text?: string, confirmed = false) => {
    home()
    if (a.kind === 'next-tab') return nextTab(a)
    setRequest({ action: a, text, confirmed })
  }
  useEffect(() => {
    if (!request) return
    const { action: a, text, confirmed } = request
    pending.current = a
    port.current?.postMessage({ type: 'run', id: a.id, label: a.label, confirmed, text } satisfies ToPage)
  }, [request])

  const nextTab = async (a: PageAction) => {
    const { windowId } = await chrome.tabs.get(tab.id)
    const tabs = await chrome.tabs.query({ windowId })
    const next = tabs[(tabs.findIndex((t) => t.id === tab.id) + 1) % tabs.length]
    if (next?.id) await chrome.tabs.update(next.id, { active: true })
    done(a)
  }

  const pick = (a: PageAction) => {
    if (a.kind === 'type') go({ kind: 'typing', action: a, text: '', row: null })
    else if (a.risk === 'irreversible') go({ kind: 'confirm', action: a })
    else execute(a)
  }
  const toItem = (a: PageAction): Item => ({ label: a.label, run: () => pick(a), target: a.id })

  const items: Item[] = (() => {
    switch (layer.kind) {
      case 'home':
        return [
          ...(ranked ?? []).slice(0, SHOWN).map(toItem),
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
        const type = (text: string) => go({ ...layer, text, row: null })
        if (layer.row !== null)
          return KEY_ROWS[layer.row].map((k) => ({
            label: k,
            run: () => (k === DONE ? layer.text.trim() && execute(layer.action, layer.text) : type(typeKey(layer.text, k))),
          }))
        return [...KEY_ROWS.map((r, i) => ({ label: r.join(' '), run: () => go({ ...layer, row: i }) })), { label: 'Cancel', run: home }]
      }
      case 'confirm':
        // Cancel is first, so a fast double signal cannot confirm.
        return [
          { label: 'Cancel', run: home },
          { label: `Confirm: ${layer.action.label}`, run: () => execute(layer.action, layer.text, true) },
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

  // Escape stops at once. This listener runs before the signal listener and keeps Escape from selecting.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      e.preventDefault()
      stopRef.current()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  // A held blink selects when the eyes open. A hold of 3 seconds stops the scan and selects nothing.
  const { videoRef, progress, paused, status, error } = useSignal(onSelect, settings.blink, settings.camera, () => stopRef.current())

  // The page outlines the element of the highlighted card. Text entry and confirm outline their target.
  const target = layer.kind === 'typing' || layer.kind === 'confirm' ? layer.action.id : (items[index]?.target ?? null)
  useEffect(() => {
    port.current?.postMessage({ type: 'highlight', id: target } satisfies ToPage)
  }, [target, page])

  // The highlight moves at the speed the user sets. In a keyboard row, one full pass returns to the row list.
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
    }, settings.stepMs)
    return () => clearInterval(id)
  }, [version, stopped, settings.stepMs])

  // Each new list asks the model. After 1.5 s the model stops, and Tier 0 ranks. The scan starts again on the first card.
  // The model reads the newest page from a ref, so a new state with the same list does not ask again.
  const latest = useRef({ page, tier0 })
  useEffect(() => {
    latest.current = { page, tier0 }
  })
  useEffect(() => {
    const now = latest.current
    if (!engine || !now.page) return
    let live = true
    let pending = true
    let timer = 0
    const timeout = new Promise<null>((resolve) => {
      timer = window.setTimeout(() => resolve(null), MODEL_WAIT_MS)
    })
    const safe = now.tier0.filter((a) => a.risk === 'safe').slice(0, MODEL_LIST)
    Promise.race([rankList(engine, now.page.description, safe), timeout])
      .catch(() => [])
      .then((ids) => {
        if (ids === null) engine.interruptGenerate()
        pending = false
        clearTimeout(timer)
        if (!live) return
        setModel({ list, ids: ids ?? [] })
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
  }, [engine, list])

  const title = {
    home: 'Next action',
    groups: 'Something else',
    group: layer.kind === 'group' ? layer.name : '',
    typing: layer.kind === 'typing' ? layer.action.label : '',
    confirm: 'Confirm',
    paused: 'Paused. Select to start again',
  }[layer.kind]

  return (
    <section className="flex flex-col gap-4">
      {(settings.camera || status === 'error') && (
        <div className="flex items-center gap-3 text-base text-muted">
          {settings.camera && status !== 'error' && <video ref={videoRef} muted playsInline className="h-12 -scale-x-100 rounded-[8px] bg-surface" />}
          {settings.camera && status === 'loading' && <span>The camera is starting. Keys work now.</span>}
          {status === 'error' && (
            <>
              <span className="flex-1">The camera did not start ({error}). Keys still work.</span>
              <button
                tabIndex={-1}
                className="btn btn-ghost min-h-11 px-4 text-base text-ink"
                onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('permission.html') })}
              >
                Allow the camera
              </button>
            </>
          )}
        </div>
      )}
      {page?.payments && <p className="text-lg">{PAYMENT_NOTICE}</p>}
      {notice && (
        <p role="status" className="text-lg">
          {notice}
        </p>
      )}
      <div className="flex items-center gap-4">
        <h2 className="flex-1 text-lg text-muted">{!page ? 'Reading the page' : layer.kind === 'home' && !ranked ? 'Thinking' : title}</h2>
        {layer.kind === 'paused' && <Ring progress={progress} size={56} />}
      </div>
      {layer.kind === 'typing' && (
        <p className="min-h-16 rounded-[14px] border border-line bg-bg/60 px-4 py-3 font-mono text-xl break-words">{layer.text || ' '}▌</p>
      )}
      {layer.kind === 'confirm' && layer.text && <p className="text-xl">“{layer.text}”</p>}
      <div className={layer.kind === 'typing' && layer.row !== null ? 'grid grid-cols-3 gap-3' : 'flex flex-col gap-3'}>
        {(page || layer.kind === 'paused' ? items : []).map((it, i) => (
          <div key={`${version}-${i}`} className="enter" style={{ '--i': i } as CSSProperties}>
            <Card label={it.label} highlight={i === index} progress={progress} />
          </div>
        ))}
      </div>
      {glow && <div aria-hidden className="pulse pointer-events-none fixed inset-0" />}
      {paused && (
        <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-bg/95 p-6 text-center">
          <p className="text-4xl font-semibold tracking-tight">Paused</p>
          <p className="text-xl">The camera does not see your face. Press any key, or return to the camera and hold a blink.</p>
        </div>
      )}
    </section>
  )
}
