// Held-blink detector. Pure functions, so tests can drive them with sample scores.

export type BlinkConfig = { threshold: number; holdMs: number }
export type Phase = 'open' | 'closed' | 'held'
export type BlinkState = { phase: Phase; since: number }
export type Sample = { t: number; score: number }

export const DEFAULT_CONFIG: BlinkConfig = { threshold: 0.5, holdMs: 500 }
export const HOLD_MIN_MS = 300
export const HOLD_MAX_MS = 1500
// The eyes must open past this fraction of the threshold to end a blink. This stops flicker at the edge.
const RELEASE = 0.8

export const initialBlink: BlinkState = { phase: 'open', since: 0 }

/** The blink score of one frame: the lower of the two eye scores, so both eyes must close. */
export function eyeScore(left: number, right: number): number {
  return Math.min(left, right)
}

/**
 * Moves the state machine one frame forward.
 * open -> closed when the score passes the threshold.
 * closed -> held after holdMs, and that frame is the one select.
 * closed or held -> open when the eyes open. A short natural blink goes closed -> open and has no effect.
 */
export function stepBlink(
  s: BlinkState,
  score: number,
  t: number,
  cfg: BlinkConfig,
): { state: BlinkState; select: boolean; progress: number } {
  if (s.phase === 'open') {
    return score >= cfg.threshold
      ? { state: { phase: 'closed', since: t }, select: false, progress: 0 }
      : { state: s, select: false, progress: 0 }
  }
  if (score < cfg.threshold * RELEASE) {
    return { state: { phase: 'open', since: t }, select: false, progress: 0 }
  }
  if (s.phase === 'held') return { state: s, select: false, progress: 1 }
  const progress = Math.min(1, (t - s.since) / cfg.holdMs)
  return progress >= 1
    ? { state: { phase: 'held', since: t }, select: true, progress: 1 }
    : { state: s, select: false, progress }
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? s[Math.floor(s.length / 2)] : 0
}

/** Durations in ms of each run of samples at or above the threshold. */
export function closedRuns(samples: Sample[], threshold: number): number[] {
  const runs: number[] = []
  let start: number | null = null
  for (const { t, score } of samples) {
    if (score >= threshold && start === null) start = t
    if (score < threshold && start !== null) {
      runs.push(t - start)
      start = null
    }
  }
  return runs
}

/**
 * Sets the threshold and the hold time from two recordings:
 * `natural` is normal viewing with natural blinks, `held` is one held blink.
 * The threshold is the middle point between the open-eye score and the held-blink score.
 * The hold time is the longest natural blink plus a margin, inside the allowed range.
 * Returns null when the two recordings do not separate, so the caller can ask the user to try again.
 */
export function calibrate(natural: Sample[], held: Sample[]): BlinkConfig | null {
  const open = median(natural.map((s) => s.score))
  const closed = median(held.map((s) => s.score).filter((x) => x > open))
  if (closed - open < 0.2) return null
  const threshold = (open + closed) / 2
  const longest = Math.max(0, ...closedRuns(natural, threshold))
  const holdMs = Math.round(Math.min(HOLD_MAX_MS, Math.max(HOLD_MIN_MS, longest + 250)))
  return { threshold, holdMs }
}
