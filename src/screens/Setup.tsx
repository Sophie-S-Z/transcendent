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

const row = 'flex min-h-16 items-center justify-between gap-8 py-3'

export function Setup({ settings, onChange, onNext }: { settings: Settings; onChange: (s: Settings) => void; onNext: (n: Next) => void }) {
  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch })
  const modeIndex = MODES.findIndex(([m]) => m === settings.mode)
  return (
    <main className="mx-auto grid min-h-dvh max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-16 px-4 py-12 sm:px-10 lg:grid-cols-[1fr_1fr] lg:gap-24">
      <section className="flex flex-col items-start gap-10">
        <Mark size={112} />
        <div>
          <h1 className="text-[clamp(2.75rem,1.5rem+4vw,4.5rem)] leading-[0.95] font-semibold tracking-[-0.03em]">Transcendent</h1>
          <p className="mt-5 max-w-[30ch] text-xl text-muted">
            Finish computer tasks with one signal: a held blink, or any key or switch. All processing stays on this device.
          </p>
        </div>
        <button className="btn chrome min-h-20 px-16 text-2xl" onClick={() => onNext('use')}>
          Start
        </button>
        <div className="flex flex-wrap gap-3">
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

      <section className="enter flex flex-col gap-10 text-lg [--i:3] lg:border-l lg:border-line lg:pl-16">
        <div className="flex flex-col divide-y divide-line">
          <h2 className="pb-3 text-sm text-muted">Input</h2>
          <label className={row}>
            Use held blinks with the camera. Any key always works.
            <input type="checkbox" className="switch" checked={settings.camera} onChange={(e) => set({ camera: e.target.checked })} />
          </label>
          {settings.camera && (
            <div className={`${row} flex-wrap text-muted`}>
              <span>
                Hold time {settings.blink.holdMs} ms, threshold {settings.blink.threshold.toFixed(2)}
              </span>
              <button className="btn btn-ghost min-h-11 text-base text-ink" onClick={() => onNext('calibrate')}>
                Calibrate and test blinks
              </button>
            </div>
          )}
          <label className="flex flex-col gap-3 py-4">
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
          <label className={row}>
            Click sound on each select
            <input type="checkbox" className="switch" checked={settings.sound} onChange={(e) => set({ sound: e.target.checked })} />
          </label>
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-sm text-muted">Mode and tester</h2>
          <div role="radiogroup" aria-label="Mode" className="relative grid grid-cols-3 rounded-[14px] border border-line bg-bg/60 p-1">
            {/* The chrome thumb slides to the selected mode. */}
            <span
              aria-hidden
              className="chrome absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-[10px] transition-[translate] duration-300 ease-in-out"
              style={{ translate: `${modeIndex * 100}% 0` }}
            />
            {MODES.map(([mode, label]) => (
              <label
                key={mode}
                className="relative grid min-h-12 cursor-pointer place-items-center rounded-[10px] px-3 text-center text-base font-semibold text-muted transition-colors duration-300 has-checked:text-bg has-focus-visible:outline-2 has-focus-visible:outline-ink"
              >
                <input type="radio" name="mode" className="sr-only" checked={settings.mode === mode} onChange={() => set({ mode })} />
                {label}
              </label>
            ))}
          </div>
          {settings.mode === 'tier1' && <p className="text-base text-muted">Tier 1 needs WebGPU.</p>}
          <input
            value={settings.tester}
            onChange={(e) => set({ tester: e.target.value })}
            placeholder="Tester name or code (optional)"
            aria-label="Tester name or code"
            className="field"
          />
        </div>
      </section>
    </main>
  )
}
