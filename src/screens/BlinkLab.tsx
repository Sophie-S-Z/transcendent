import { useRef, useState } from 'react'
import {
  calibrate,
  heldBlinkDone,
  holdFor,
  HOLD_MAX_MS,
  HOLD_MIN_MS,
  initialBlink,
  stepBlink,
  type BlinkConfig,
  type Sample,
} from '../input/blink'
import { useFaceBlink, type FaceFrame } from '../input/useFaceBlink'
import { click } from '../ui/click'
import { Ring } from '../ui/Ring'

// Calibration: 8 s of natural blinks, 4 s of a look down, then one held blink (the stage stops when it ends, 8 s or less).
// Gate A: 60 s of reading. The PRD target is 1 false select or fewer in 5 minutes, so the pass in 60 s is 0.
// The reading test also measures the longest natural blink and raises the hold time if that blink came close.
const STAGE_MS = { natural: 8_000, down: 4_000, held: 8_000, reading: 60_000 }

type Stage =
  | { name: 'idle' | 'failed' }
  | { name: 'natural' | 'down' | 'held' | 'reading'; start: number }

const PROMPT: Record<Stage['name'], string> = {
  idle: 'Sit 50 to 70 cm from the camera, with light on your face.',
  natural: 'Look at the screen and blink as you normally do.',
  down: 'Look down at your keyboard. Keep your eyes open.',
  held: 'Close your eyes now. Keep them closed for 1 second, then open them.',
  reading: 'Read the text below. Do not hold a blink.',
  failed: 'Calibration could not tell a held blink from open eyes or a look down. Add light, close your eyes fully, and try again.',
}

/**
 * Calibration (T1) and the Gate A reading test. onGate receives each reading test result.
 * onDone receives the blink settings to keep.
 */
export function BlinkLab({
  initial,
  onGate,
  onDone,
}: {
  initial: BlinkConfig
  onGate: (falseSelects: number, ms: number) => void
  onDone: (cfg: BlinkConfig) => void
}) {
  const [cfg, setCfg] = useState(initial)
  const [stage, setStage] = useState<Stage>({ name: 'idle' })
  const [frame, setFrame] = useState<FaceFrame | null>(null)
  const [progress, setProgress] = useState(0)
  const [selects, setSelects] = useState(0)
  const [gate, setGate] = useState<{ falseSelects: number; longest: number; holdMs: number } | null>(null)
  const [glow, setGlow] = useState(false)

  const machine = useRef(initialBlink)
  const natural = useRef<Sample[]>([])
  const down = useRef<Sample[]>([])
  const held = useRef<Sample[]>([])
  const readCount = useRef(0)
  const longest = useRef(0)

  const { videoRef, status, error } = useFaceBlink((f) => {
    setFrame(f)
    // Frames with no face give no sample, but the stage still ends on time.
    const sample = f.score === null ? [] : [{ t: f.t, score: f.score }]

    if (stage.name === 'natural') {
      natural.current.push(...sample)
      if (f.t - stage.start >= STAGE_MS.natural) setStage({ name: 'down', start: f.t })
      return
    }
    if (stage.name === 'down') {
      down.current.push(...sample)
      if (f.t - stage.start >= STAGE_MS.down) setStage({ name: 'held', start: f.t })
      return
    }
    if (stage.name === 'held') {
      held.current.push(...sample)
      if (heldBlinkDone(natural.current, held.current) || f.t - stage.start >= STAGE_MS.held) {
        const next = calibrate(natural.current, down.current, held.current)
        if (next) setCfg(next)
        setStage({ name: next ? 'idle' : 'failed' })
      }
      return
    }
    if (stage.name === 'reading' && f.t - stage.start >= STAGE_MS.reading) {
      const holdMs = Math.max(cfg.holdMs, holdFor(longest.current))
      setCfg({ ...cfg, holdMs })
      setGate({ falseSelects: readCount.current, longest: longest.current, holdMs })
      onGate(readCount.current, STAGE_MS.reading)
      setStage({ name: 'idle' })
    }
    if (f.score === null) return

    const prev = machine.current
    const r = stepBlink(prev, f.score, f.t, cfg)
    machine.current = r.state
    // A blink that closed and opened again with no select is a natural blink. Keep the longest one.
    if (stage.name === 'reading' && prev.phase === 'closed' && r.state.phase === 'open')
      longest.current = Math.max(longest.current, f.t - prev.since)
    setProgress(r.progress)
    if (r.select) {
      click()
      setSelects((n) => n + 1)
      setGlow(true)
      setTimeout(() => setGlow(false), 250)
      if (stage.name === 'reading') readCount.current += 1
    }
  })

  const startCalibration = () => {
    natural.current = []
    down.current = []
    held.current = []
    setStage({ name: 'natural', start: performance.now() })
  }
  const startReading = () => {
    readCount.current = 0
    longest.current = 0
    machine.current = initialBlink
    setGate(null)
    setStage({ name: 'reading', start: performance.now() })
  }
  const remaining = 'start' in stage && frame ? Math.max(0, STAGE_MS[stage.name] - (frame.t - stage.start)) : 0
  const busy = stage.name !== 'idle' && stage.name !== 'failed'

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-10 px-10 py-10">
      <header className="flex items-baseline justify-between border-b border-line pb-5">
        <h1 className="text-3xl font-bold">Blink calibration</h1>
        <span className="text-muted">{status === 'ready' ? 'Camera on' : status === 'loading' ? 'Loading' : 'Error'}</span>
      </header>

      {status === 'error' && <p className="text-accent">Camera or model error: {error}</p>}

      <div className="grid gap-12 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <section className="flex flex-col gap-6">
          <video ref={videoRef} muted playsInline className="w-full max-w-[360px] -scale-x-100 rounded-[16px] border border-line bg-surface" />
          <div className="flex items-center gap-8">
            <div className="flex flex-col items-center gap-1">
              <Ring progress={progress} size={112} glow={glow} />
              <span className="font-mono text-2xl">{selects}</span>
              <span className="text-sm text-muted">selects</span>
            </div>
            <dl className="grid flex-1 grid-cols-[auto_1fr] gap-x-6 gap-y-2">
              <dt className="text-muted">Score</dt>
              <dd className="font-mono">{frame?.score == null ? 'No face' : frame.score.toFixed(2)}</dd>
              <dt className="text-muted">Frame time</dt>
              <dd className="font-mono">{frame ? `${frame.detectMs.toFixed(0)} ms` : '-'}</dd>
              <dt className="text-muted">Threshold</dt>
              <dd className="font-mono">{cfg.threshold.toFixed(2)}</dd>
              <dt className="text-muted">Hold</dt>
              <dd className="font-mono">{cfg.holdMs} ms</dd>
            </dl>
          </div>
          <div className="flex flex-col gap-3 border-t border-line pt-5">
            <label className="flex items-center gap-4">
              <span className="w-24">Hold time</span>
              <input
                type="range"
                min={HOLD_MIN_MS}
                max={HOLD_MAX_MS}
                step={50}
                value={cfg.holdMs}
                onChange={(e) => setCfg({ ...cfg, holdMs: Number(e.target.value) })}
                className="h-8 flex-1"
              />
            </label>
            <label className="flex items-center gap-4">
              <span className="w-24">Threshold</span>
              <input
                type="range"
                min={0.1}
                max={0.9}
                step={0.01}
                value={cfg.threshold}
                onChange={(e) => setCfg({ ...cfg, threshold: Number(e.target.value) })}
                className="h-8 flex-1"
              />
            </label>
          </div>
        </section>

        <section className="flex min-w-0 flex-col gap-6">
          <p className="text-3xl leading-snug">{PROMPT[stage.name]}</p>
          {busy && <p className="font-mono text-muted">{Math.ceil(remaining / 1000)} s left</p>}
          {gate && (
            <div className="enter flex flex-col gap-2 border-t border-line pt-5">
              <p className="text-2xl">
                Gate A: {gate.falseSelects} false {gate.falseSelects === 1 ? 'select' : 'selects'} in 60 s.{' '}
                <strong className={gate.falseSelects === 0 ? 'text-ink' : 'text-accent'}>{gate.falseSelects === 0 ? 'Pass' : 'Fail'}</strong>
              </p>
              <p className="text-muted">
                Longest natural blink <span className="font-mono">{Math.round(gate.longest)}</span> ms. Hold time{' '}
                <span className="font-mono">{gate.holdMs}</span> ms. Margin{' '}
                <span className="font-mono">{Math.round(gate.holdMs - gate.longest)}</span> ms.
              </p>
            </div>
          )}
          <div className="flex flex-wrap gap-4">
            <button disabled={busy || status !== 'ready'} onClick={startCalibration} className={buttonClass(true)}>
              Calibrate (about 16 s)
            </button>
            <button disabled={busy || status !== 'ready'} onClick={startReading} className={buttonClass(false)}>
              Start 1-minute reading test
            </button>
            <button disabled={busy} onClick={() => onDone(cfg)} className={buttonClass(false)}>
              Save and close
            </button>
          </div>
          {stage.name === 'reading' && (
            <div className="enter max-h-[42dvh] overflow-auto border-t border-line pt-6 pr-4">
              <ReadingText />
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function buttonClass(primary: boolean) {
  return `btn px-6 text-lg ${primary ? 'chrome' : 'btn-ghost'}`
}

function ReadingText() {
  return (
    <article className="flex max-w-2xl flex-col gap-5 text-xl leading-relaxed">
      <p>
        A scanning keyboard shows the letters in groups. A highlight moves from one group to the next. When the
        highlight reaches the correct group, the user gives a signal. Then the highlight moves through the letters of
        that group, and the user gives a second signal to select the letter.
      </p>
      <p>
        Each letter costs two signals or more, and each signal costs time. The user must wait for the highlight to
        arrive. A short message of twenty words can take ten minutes or more. Mistakes cost more time, because the user
        must find and select the delete key.
      </p>
      <p>
        Prediction can reduce this cost. A system that knows the context can guess the next word or the next action.
        If the guess is correct, the user selects it with one signal. If the guess is wrong, the user continues to the
        next item. A good guess saves many signals, and a bad guess costs only one step.
      </p>
      <p>
        This test measures false selects. Read at your normal speed and blink as you normally do. Move your head a
        little, as you do when you read. At the end of 1 minute, the screen shows the number of selects that
        occurred. Zero false selects is a pass. The test also raises the hold time if a natural blink came close to it.
      </p>
      <p>
        If the test fails, calibrate again in better light, or increase the hold time. Glasses can reduce the quality of
        the signal. A lamp in front of you and a plain wall behind you give the best result.
      </p>
    </article>
  )
}
