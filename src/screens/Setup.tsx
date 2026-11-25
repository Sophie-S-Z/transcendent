// The setup screen for the caregiver or the observer. It uses the mouse.
import { STEP_MAX_MS, STEP_MIN_MS, type Settings } from '../settings'
import type { Mode } from '../eval/log'
import { Mark } from '../ui/Liquid'

export type Next = 'calibrate' | 'use' | 'session' | 'results' | 'probe'

const MODES: [Mode, string][] = [
  ['tier0', 'Tier 0 rules'],
  ['tier1', 'Tier 1 model'],
  ['baseline', 'Baseline keyboard'],
]

const row = 'flex min-h-16 items-center justify-between gap-6'

export function Setup({ settings, onChange, onNext }: { settings: Settings; onChange: (s: Settings) => void; onNext: (n: Next) => void }) {
  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch })
  return (
    <main className="mx-auto grid min-h-dvh max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-12 p-4 sm:p-8 lg:grid-cols-[1fr_1.15fr]">
      <section className="enter flex flex-col items-start gap-8">
        <Mark size={168} />
        <div>
          <h1 className="text-[clamp(2.5rem,1rem+4vw,3.5rem)] leading-none font-bold tracking-tight">Transcendent</h1>
          <p className="mt-6 max-w-[26ch] text-xl text-muted">
            Finish computer tasks with one signal: a held blink, or any key or switch. All processing stays on this device.
          </p>
        </div>
        <button className="btn chrome min-h-24 px-16 text-2xl" onClick={() => onNext('use')}>
          Start
        </button>
        <div className="flex flex-wrap gap-3 text-lg">
          <button className="btn btn-ghost" onClick={() => onNext('session')}>
            Start test session
          </button>
          <button className="btn btn-ghost" onClick={() => onNext('results')}>
            Results
          </button>
          <button className="btn btn-ghost" onClick={() => onNext('probe')}>
            Model speed test
          </button>
        </div>
      </section>

      <section className="glass enter flex flex-col gap-6 p-6 text-lg [--i:2] sm:p-8">
        <h2 className="text-xl font-bold">Input</h2>
        <label className={row}>
          Use held blinks with the camera. Any key always works.
          <input type="checkbox" className="switch" checked={settings.camera} onChange={(e) => set({ camera: e.target.checked })} />
        </label>
        {settings.camera && (
          <div className={`${row} flex-wrap text-muted`}>
            <span>
              Hold time {settings.blink.holdMs} ms, threshold {settings.blink.threshold.toFixed(2)}
            </span>
            <button className="btn btn-ghost min-h-12 text-ink" onClick={() => onNext('calibrate')}>
              Calibrate and test blinks
            </button>
          </div>
        )}
        <label className="flex flex-col gap-2">
          Highlight speed: {(settings.stepMs / 1000).toFixed(1)} s
          <input
            type="range"
            min={STEP_MIN_MS}
            max={STEP_MAX_MS}
            step={100}
            value={settings.stepMs}
            onChange={(e) => set({ stepMs: Number(e.target.value) })}
            className="h-8"
          />
        </label>
        <label className={row}>
          Click sound on each select
          <input type="checkbox" className="switch" checked={settings.sound} onChange={(e) => set({ sound: e.target.checked })} />
        </label>

        <hr className="border-line" />

        <h2 className="text-xl font-bold">Mode and tester</h2>
        <div role="radiogroup" aria-label="Mode" className="grid grid-cols-3 gap-1 rounded-[22px] border border-line bg-bg/60 p-1">
          {MODES.map(([mode, label]) => (
            <label
              key={mode}
              className="grid min-h-16 cursor-pointer place-items-center rounded-[18px] px-3 text-center text-base font-bold text-muted transition-colors duration-150 has-checked:chrome has-focus-visible:outline-2 has-focus-visible:outline-ink"
            >
              <input type="radio" name="mode" className="sr-only" checked={settings.mode === mode} onChange={() => set({ mode })} />
              {label}
            </label>
          ))}
        </div>
        {settings.mode === 'tier1' && <p className="-mt-2 text-base text-muted">Tier 1 needs WebGPU.</p>}
        <input
          value={settings.tester}
          onChange={(e) => set({ tester: e.target.value })}
          placeholder="Tester name or code (optional)"
          aria-label="Tester name or code"
          className="field"
        />
      </section>
    </main>
  )
}
