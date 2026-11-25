import { useRef, useState } from 'react'
import {
  calibrate,
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

// Gate A prototype: calibrate, then count false selects during 5 minutes of reading.
const NATURAL_MS = 20_000
const HELD_MS = 10_000
const READ_MS = 5 * 60_000

type Stage =
  | { name: 'idle' | 'failed' }
  | { name: 'natural' | 'held' | 'reading'; start: number }

const PROMPT: Record<Stage['name'], string> = {
  idle: 'Sit 50 to 70 cm from the camera, with light on your face.',
  natural: 'Look at the screen and blink as you normally do.',
  held: 'Close your eyes, keep them closed for 2 seconds, then open them.',
  reading: 'Read the text below. Do not hold a blink.',
  failed: 'Calibration did not find a clear held blink. Try again with more light.',
}

/** Calibration (T1) and the Gate A reading test. onDone receives the blink settings to keep. */
export function BlinkLab({ initial, onDone }: { initial: BlinkConfig; onDone: (cfg: BlinkConfig) => void }) {
  const [cfg, setCfg] = useState(initial)
  const [stage, setStage] = useState<Stage>({ name: 'idle' })
  const [frame, setFrame] = useState<FaceFrame | null>(null)
  const [progress, setProgress] = useState(0)
  const [selects, setSelects] = useState(0)
  const [falseSelects, setFalseSelects] = useState<number | null>(null)
  const [glow, setGlow] = useState(false)

  const machine = useRef(initialBlink)
  const natural = useRef<Sample[]>([])
  const held = useRef<Sample[]>([])
  const readCount = useRef(0)

  const { videoRef, status, error } = useFaceBlink((f) => {
    setFrame(f)
    // Frames with no face give no sample, but the stage still ends on time.
    const sample = f.score === null ? [] : [{ t: f.t, score: f.score }]

    if (stage.name === 'natural') {
      natural.current.push(...sample)
      if (f.t - stage.start >= NATURAL_MS) setStage({ name: 'held', start: f.t })
      return
    }
    if (stage.name === 'held') {
      held.current.push(...sample)
      if (f.t - stage.start >= HELD_MS) {
        const next = calibrate(natural.current, held.current)
        if (next) setCfg(next)
        setStage({ name: next ? 'idle' : 'failed' })
      }
      return
    }
    if (stage.name === 'reading' && f.t - stage.start >= READ_MS) {
      setFalseSelects(readCount.current)
      setStage({ name: 'idle' })
    }
    if (f.score === null) return

    const r = stepBlink(machine.current, f.score, f.t, cfg)
    machine.current = r.state
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
    held.current = []
    setStage({ name: 'natural', start: performance.now() })
  }
  const startReading = () => {
    readCount.current = 0
    setFalseSelects(null)
    setStage({ name: 'reading', start: performance.now() })
  }
  const remaining = 'start' in stage && frame ? Math.max(0, stageLength(stage.name) - (frame.t - stage.start)) : 0
  const busy = stage.name !== 'idle' && stage.name !== 'failed'

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 p-8">
      <header className="flex items-baseline justify-between">
        <h1 className="text-4xl font-bold">Blink calibration</h1>
        <span className="font-mono text-muted">{status === 'ready' ? 'Camera on' : status === 'loading' ? 'Loading' : 'Error'}</span>
      </header>

      {status === 'error' && <p className="text-accent">Camera or model error: {error}</p>}

      <section className="flex flex-wrap items-center gap-8">
        <video ref={videoRef} muted playsInline className="w-80 -scale-x-100 rounded-2xl bg-surface" />
        <div className="flex flex-col items-center gap-2">
          <Ring progress={progress} glow={glow} />
          <span className="font-mono text-4xl">{selects}</span>
          <span className="text-muted">selects</span>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 font-mono">
          <dt className="text-muted">Score</dt>
          <dd>{frame?.score == null ? 'No face' : frame.score.toFixed(2)}</dd>
          <dt className="text-muted">Detect</dt>
          <dd>{frame ? `${frame.detectMs.toFixed(0)} ms` : '-'}</dd>
          <dt className="text-muted">Threshold</dt>
          <dd>{cfg.threshold.toFixed(2)}</dd>
          <dt className="text-muted">Hold</dt>
          <dd>{cfg.holdMs} ms</dd>
        </dl>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl bg-surface p-8">
        <p className="text-3xl">{PROMPT[stage.name]}</p>
        {busy && <p className="font-mono text-muted">{Math.ceil(remaining / 1000)} s left</p>}
        {falseSelects !== null && (
          <p className="text-3xl">
            Gate A: {falseSelects} false {falseSelects === 1 ? 'select' : 'selects'} in 5 minutes.{' '}
            <strong className="text-accent">{falseSelects <= 1 ? 'Pass' : 'Fail'}</strong>
          </p>
        )}
        <div className="flex flex-wrap gap-4">
          <button disabled={busy || status !== 'ready'} onClick={startCalibration} className={buttonClass(true)}>
            Calibrate (30 s)
          </button>
          <button disabled={busy || status !== 'ready'} onClick={startReading} className={buttonClass(false)}>
            Start 5-minute reading test
          </button>
          <button disabled={busy} onClick={() => onDone(cfg)} className={buttonClass(false)}>
            Save and close
          </button>
        </div>
        <label className="flex items-center gap-4">
          <span className="w-56">Hold time</span>
          <input
            type="range"
            min={HOLD_MIN_MS}
            max={HOLD_MAX_MS}
            step={50}
            value={cfg.holdMs}
            onChange={(e) => setCfg({ ...cfg, holdMs: Number(e.target.value) })}
            className="h-12 flex-1 accent-accent"
          />
        </label>
        <label className="flex items-center gap-4">
          <span className="w-56">Threshold</span>
          <input
            type="range"
            min={0.1}
            max={0.9}
            step={0.01}
            value={cfg.threshold}
            onChange={(e) => setCfg({ ...cfg, threshold: Number(e.target.value) })}
            className="h-12 flex-1 accent-accent"
          />
        </label>
      </section>

      {stage.name === 'reading' && <ReadingText />}
    </main>
  )
}

function stageLength(name: Stage['name']) {
  return name === 'natural' ? NATURAL_MS : name === 'held' ? HELD_MS : READ_MS
}

function buttonClass(primary: boolean) {
  return `min-h-24 rounded-2xl px-8 text-2xl font-bold disabled:opacity-40 ${
    primary ? 'bg-accent text-bg' : 'border-2 border-ink text-ink'
  }`
}

function ReadingText() {
  return (
    <article className="flex max-w-3xl flex-col gap-6 text-2xl leading-relaxed">
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
        little, as you do when you read. At the end of five minutes, the screen shows the number of selects that
        occurred. One false select or fewer is a pass.
      </p>
      <p>
        If the test fails, calibrate again in better light, or increase the hold time. Glasses can reduce the quality of
        the signal. A lamp in front of you and a plain wall behind you give the best result.
      </p>
    </article>
  )
}
