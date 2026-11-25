import { describe, expect, it } from 'vitest'
import { initialBlink, stepBlink, type BlinkConfig } from './blink'
import { PAUSE_MS, stepHold, type Hold } from './hold'

const cfg: BlinkConfig = { threshold: 0.5, holdMs: 500 }

/** Runs a closed-eye hold of `ms`, then one open frame, at 10 ms per frame. Returns the actions. */
function run(ms: number) {
  let blink = initialBlink
  let hold: Hold = { start: 0, toggled: false }
  const actions: string[] = []
  for (let t = 0; t <= ms + 10; t += 10) {
    const r = stepBlink(blink, t <= ms ? 1 : 0, t, cfg)
    const h = stepHold(hold, blink.phase, r.state.phase, t)
    blink = r.state
    hold = h.hold
    if (h.action) actions.push(h.action)
  }
  return actions
}

describe('stepHold', () => {
  it('sends no key for a natural blink', () => expect(run(200)).toEqual([]))
  it('sends one key when the eyes open after a held blink', () => expect(run(800)).toEqual(['press']))
  it('toggles the pause at 3 s and sends no key', () => expect(run(PAUSE_MS + 500)).toEqual(['toggle']))
  it('toggles one time for one long hold', () => expect(run(PAUSE_MS * 3)).toEqual(['toggle']))
})
