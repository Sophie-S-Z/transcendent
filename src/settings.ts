import { DEFAULT_CONFIG, type BlinkConfig } from './input/blink'
import type { Mode } from './eval/log'

export type Settings = {
  blink: BlinkConfig
  /** True to use held blinks. Any key press always works. */
  camera: boolean
  /** Time of the highlight on each item, 600 to 3000 ms (T7). */
  stepMs: number
  sound: boolean
  mode: Mode
  tester: string
  /** The scenario pack for demo mode. 'eval' is the measured set. */
  scenario: string
}

export const STEP_MIN_MS = 600
export const STEP_MAX_MS = 3000

const DEFAULTS: Settings = { blink: DEFAULT_CONFIG, camera: true, stepMs: 1200, sound: true, mode: 'tier0', tester: '', scenario: 'eval' }
const KEY = 'transcendent.settings'

export function loadSettings(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return DEFAULTS
  }
}

export function saveSettings(s: Settings) {
  localStorage.setItem(KEY, JSON.stringify(s))
}
