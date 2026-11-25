import type { Phase } from './blink'

/** A held blink of this length turns the switch off or on, so the user can rest. */
export const PAUSE_MS = 3000

export type Hold = { start: number; toggled: boolean }
export type HoldAction = 'press' | 'toggle' | null

/**
 * Turns the blink phase change of one frame into one action.
 * The key press waits until the eyes open. Thus a 3-second hold toggles the pause and sends no key.
 */
export function stepHold(h: Hold, prev: Phase, next: Phase, t: number): { hold: Hold; action: HoldAction } {
  if (prev === 'open' && next !== 'open') return { hold: { start: t, toggled: false }, action: null }
  if (next === 'held' && !h.toggled && t - h.start >= PAUSE_MS) return { hold: { ...h, toggled: true }, action: 'toggle' }
  if (prev === 'held' && next === 'open' && !h.toggled) return { hold: h, action: 'press' }
  return { hold: h, action: null }
}
