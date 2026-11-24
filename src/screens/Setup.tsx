// The setup screen for the caregiver or the observer. It uses the mouse.
import { STEP_MAX_MS, STEP_MIN_MS, type Settings } from '../settings'
import type { Mode } from '../eval/log'

export type Next = 'calibrate' | 'use' | 'session' | 'results' | 'probe'

const button = 'min-h-24 rounded-2xl px-8 text-2xl font-bold'
const MODES: [Mode, string][] = [
  ['tier0', 'Tier 0 rules'],
  ['tier1', 'Tier 1 model (needs WebGPU)'],
  ['baseline', 'Baseline keyboard'],
]

export function Setup({ settings, onChange, onNext }: { settings: Settings; onChange: (s: Settings) => void; onNext: (n: Next) => void }) {
  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch })
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 p-8">
      <header>
        <h1 className="text-5xl font-bold">Transcendent</h1>
        <p className="mt-2 text-muted">
          Finish computer tasks with one signal: a held blink, or any key or switch. All processing stays on this device.
        </p>
      </header>

      <section className="flex flex-col gap-4 rounded-2xl bg-surface p-8">
        <h2 className="text-2xl font-bold">Input</h2>
        <label className="flex min-h-12 items-center gap-4">
          <input type="checkbox" className="size-8 accent-accent" checked={settings.camera} onChange={(e) => set({ camera: e.target.checked })} />
          Use held blinks with the camera. Any key always works.
        </label>
        {settings.camera && (
          <p className="text-muted">
            Hold time {settings.blink.holdMs} ms, threshold {settings.blink.threshold.toFixed(2)}.{' '}
            <button className="underline" onClick={() => onNext('calibrate')}>
              Calibrate and test blinks
            </button>
          </p>
        )}
        <label className="flex items-center gap-4">
          <span className="w-72">Highlight speed: {(settings.stepMs / 1000).toFixed(1)} s</span>
          <input
            type="range"
            min={STEP_MIN_MS}
            max={STEP_MAX_MS}
            step={100}
            value={settings.stepMs}
            onChange={(e) => set({ stepMs: Number(e.target.value) })}
            className="h-12 flex-1 accent-accent"
          />
        </label>
        <label className="flex min-h-12 items-center gap-4">
          <input type="checkbox" className="size-8 accent-accent" checked={settings.sound} onChange={(e) => set({ sound: e.target.checked })} />
          Click sound on each select
        </label>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl bg-surface p-8">
        <h2 className="text-2xl font-bold">Mode and tester</h2>
        <div className="flex flex-wrap gap-4">
          {MODES.map(([mode, label]) => (
            <label key={mode} className="flex min-h-12 items-center gap-2">
              <input type="radio" name="mode" className="size-8 accent-accent" checked={settings.mode === mode} onChange={() => set({ mode })} />
              {label}
            </label>
          ))}
        </div>
        <input
          value={settings.tester}
          onChange={(e) => set({ tester: e.target.value })}
          placeholder="Tester name or code"
          className="min-h-12 rounded-lg bg-bg px-4"
        />
      </section>

      <div className="flex flex-wrap gap-4">
        <button className={`${button} bg-accent text-bg`} onClick={() => onNext('use')}>
          Start
        </button>
        <button className={`${button} border-2 border-ink`} onClick={() => onNext('session')}>
          Start test session
        </button>
        <button className={`${button} border-2 border-ink`} onClick={() => onNext('results')}>
          Results
        </button>
        <button className={`${button} border-2 border-ink`} onClick={() => onNext('probe')}>
          Model speed test
        </button>
      </div>
    </main>
  )
}
