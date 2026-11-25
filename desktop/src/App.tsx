import { useEffect, useRef, useState } from 'react'
import { calibrate, DEFAULT_CONFIG, heldBlinkDone, initialBlink, stepBlink, type BlinkConfig, type Sample } from '../../src/input/blink'
import { useFaceBlink } from '../../src/input/useFaceBlink'
import { Ring } from '../../src/ui/Ring'
import { stepHold, type Hold } from '../../src/input/hold'

declare global {
  interface Window {
    __TAURI__?: { core: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown> } }
  }
}

// The keys that the Rust command accepts.
const KEYS = ['Space', 'Enter'] as const
type Key = (typeof KEYS)[number]
type Saved = { blink: BlinkConfig; key: Key; calibrated: boolean }

const STORE = 'transcendent.switch'
const DEFAULTS: Saved = { blink: DEFAULT_CONFIG, key: 'Space', calibrated: false }

function load(): Saved {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORE) ?? '{}') }
  } catch {
    return DEFAULTS
  }
}

// A short calibration: natural blinks, a look down, then one held blink. The held stage stops when the blink ends.
const STAGE_MS = { natural: 6_000, down: 3_000, held: 6_000 }
type Stage = 'natural' | 'down' | 'held'
const PROMPT: Record<Stage, string> = {
  natural: 'Look at the screen and blink as you normally do.',
  down: 'Look down at your keyboard. Keep your eyes open.',
  held: 'Close your eyes for 1 second, then open them.',
}

/** The switch window: one held blink sends one key press to the whole system. */
export function App() {
  const [saved, setSaved] = useState(load)
  const [calib, setCalib] = useState<{ stage: Stage; start: number } | null>(null)
  const [failed, setFailed] = useState(false)
  const [paused, setPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const [heldMs, setHeldMs] = useState(0)
  const [error, setError] = useState('')

  const blink = useRef(initialBlink)
  const hold = useRef<Hold>({ start: 0, toggled: false })
  const samples = useRef<Record<Stage, Sample[]>>({ natural: [], down: [], held: [] })

  const save = (next: Saved) => {
    setSaved(next)
    localStorage.setItem(STORE, JSON.stringify(next))
  }

  // The window must not act on the key that it sends, for example when a button has focus.
  useEffect(() => {
    const stop = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') e.preventDefault()
    }
    window.addEventListener('keydown', stop)
    return () => window.removeEventListener('keydown', stop)
  }, [])

  const press = () => {
    const invoke = window.__TAURI__?.core.invoke
    if (!invoke) return setError('No desktop app: the key was not sent.')
    invoke('press_key', { key: saved.key }).then(
      () => setError(''),
      (e) => setError(String(e)),
    )
  }

  const { videoRef, status, error: cameraError } = useFaceBlink(({ t, score }) => {
    if (calib) {
      if (score !== null) samples.current[calib.stage].push({ t, score })
      const s = samples.current
      if (calib.stage === 'natural' && t - calib.start >= STAGE_MS.natural) setCalib({ stage: 'down', start: t })
      if (calib.stage === 'down' && t - calib.start >= STAGE_MS.down) setCalib({ stage: 'held', start: t })
      if (calib.stage === 'held' && (heldBlinkDone(s.natural, s.held) || t - calib.start >= STAGE_MS.held)) {
        const next = calibrate(s.natural, s.down, s.held)
        if (next) save({ ...saved, blink: next, calibrated: true })
        setFailed(!next)
        setCalib(null)
      }
      return
    }
    // With no face in view, the hold starts again.
    if (score === null) {
      blink.current = initialBlink
      setProgress(0)
      setHeldMs(0)
      return
    }
    const r = stepBlink(blink.current, score, t, saved.blink)
    const h = stepHold(hold.current, blink.current.phase, r.state.phase, t)
    blink.current = r.state
    hold.current = h.hold
    setProgress(r.progress)
    setHeldMs(r.state.phase === 'open' ? 0 : t - h.hold.start)
    if (h.action === 'toggle') setPaused((p) => !p)
    if (h.action === 'press' && !paused) press()
  })

  const startCalibration = () => {
    samples.current = { natural: [], down: [], held: [] }
    setFailed(false)
    setCalib({ stage: 'natural', start: performance.now() })
  }

  const message = calib
    ? PROMPT[calib.stage]
    : status === 'loading'
      ? 'Starting the camera.'
      : status === 'error'
        ? `The camera did not start: ${cameraError}`
        : failed
          ? 'Calibration did not work. Add light and try again.'
          : !saved.calibrated
            ? 'Calibrate before you use the switch.'
            : paused
              ? 'Paused. Hold a blink for 3 s to resume.'
              : progress >= 1
                ? `Open your eyes to press “${saved.key}”. Keep them closed 3 s to pause.`
                : `Hold a blink to press “${saved.key}”. Hold 3 s to pause.`

  return (
    <main className="flex h-dvh flex-col gap-3 overflow-hidden p-4 select-none">
      <div className="flex items-center justify-between gap-3">
        <video ref={videoRef} muted playsInline className="h-[105px] w-[140px] -scale-x-100 rounded-lg bg-surface object-cover" />
        <div className={paused ? 'opacity-40' : ''}>
          <Ring progress={progress} size={104} glow={progress >= 1} />
        </div>
      </div>
      <p className="font-mono text-xs text-muted">
        Hold {(heldMs / 1000).toFixed(2)} of {(saved.blink.holdMs / 1000).toFixed(2)} s · Threshold{' '}
        {saved.blink.threshold.toFixed(2)}
      </p>
      <p className="min-h-[3em] leading-snug">{message}</p>
      {error && <p className="text-sm text-accent">{error}</p>}
      <div className="mt-auto flex gap-2">
        <button disabled={!!calib} onClick={() => setPaused(!paused)} className="btn lit flex-1 px-3">
          {paused ? 'Resume' : 'Pause'}
        </button>
        <button disabled={!!calib || status !== 'ready'} onClick={startCalibration} className="btn btn-ghost flex-1 px-3">
          Calibrate
        </button>
      </div>
      <label className="flex items-center justify-between gap-3">
        <span className="text-muted">Key to send</span>
        <select
          value={saved.key}
          onChange={(e) => save({ ...saved, key: e.target.value as Key })}
          className="field min-h-10 bg-bg"
        >
          {KEYS.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
      </label>
    </main>
  )
}
