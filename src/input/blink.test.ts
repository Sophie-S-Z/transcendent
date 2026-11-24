import { describe, expect, it } from 'vitest'
import { calibrate, closedRuns, initialBlink, stepBlink, type Sample } from './blink'

const cfg = { threshold: 0.5, holdMs: 500 }

/** Runs scores at 30 frames per second and returns the frame times of each select. */
function run(scores: number[]) {
  let s = initialBlink
  const selects: number[] = []
  scores.forEach((score, i) => {
    const r = stepBlink(s, score, i * 33, cfg)
    s = r.state
    if (r.select) selects.push(i * 33)
  })
  return selects
}
const frames = (n: number, score: number) => Array<number>(n).fill(score)

describe('stepBlink', () => {
  it('ignores a short natural blink', () => {
    expect(run([...frames(10, 0.1), ...frames(5, 0.9), ...frames(10, 0.1)])).toEqual([])
  })

  it('sends one select for a held blink, even if the hold continues', () => {
    expect(run([...frames(5, 0.1), ...frames(60, 0.9), ...frames(5, 0.1)])).toHaveLength(1)
  })

  it('sends a select only after the hold time', () => {
    const [t] = run([...frames(5, 0.1), ...frames(30, 0.9)])
    expect(t - 5 * 33).toBeGreaterThanOrEqual(500)
  })

  it('does not end a blink on a small dip above the release level', () => {
    const dip = [...frames(8, 0.9), 0.45, ...frames(10, 0.9)]
    expect(run([0.1, ...dip])).toHaveLength(1)
  })

  it('reports progress from 0 to 1 during the hold', () => {
    const r = stepBlink({ phase: 'closed', since: 0 }, 0.9, 250, cfg)
    expect(r.progress).toBeCloseTo(0.5)
  })
})

describe('calibrate', () => {
  const series = (scores: number[]): Sample[] => scores.map((score, i) => ({ t: i * 33, score }))
  const natural = series([...frames(30, 0.05), ...frames(4, 0.8), ...frames(30, 0.05), ...frames(5, 0.8), ...frames(30, 0.05)])
  const held = series([...frames(5, 0.05), ...frames(40, 0.85)])

  it('sets the threshold between open and closed eyes', () => {
    const c = calibrate(natural, held)!
    expect(c.threshold).toBeGreaterThan(0.3)
    expect(c.threshold).toBeLessThan(0.6)
  })

  it('sets the hold time above the longest natural blink, inside the range', () => {
    const c = calibrate(natural, held)!
    expect(c.holdMs).toBeGreaterThan(Math.max(...closedRuns(natural, c.threshold)))
    expect(c.holdMs).toBeGreaterThanOrEqual(300)
    expect(c.holdMs).toBeLessThanOrEqual(1500)
  })

  it('returns null when the held blink does not differ from open eyes', () => {
    expect(calibrate(natural, series(frames(40, 0.1)))).toBeNull()
  })
})
