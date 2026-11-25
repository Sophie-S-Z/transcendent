// The session log: one record for each task attempt. It gives the CSV export and the summary for each mode.

export type Mode = 'baseline' | 'tier0' | 'tier1'

export type TaskRecord = {
  session: string
  tester: string
  mode: Mode
  /** A number for the 10 tasks. A string for a hold-out task or 'help'. */
  task: number | string
  signals: number
  ms: number
  /** Undone or rejected actions. */
  errors: number
  /** Prediction steps where the chosen action had rank 1. */
  topHits: number
  /** Prediction steps where the chosen action was on the home screen (the 4 predicted cards plus "Something else" make 5 items). */
  top5Hits: number
  /** Ranked screens where the user chose an action. */
  steps: number
  completed: boolean
  /** ISO time. */
  startedAt: string
  /** The scenario pack. Records from before scenarios have none; they belong to 'eval'. */
  scenario?: string
}

const COLUMNS: (keyof TaskRecord)[] = [
  'session', 'tester', 'mode', 'task', 'signals', 'ms', 'errors', 'topHits', 'top5Hits', 'steps', 'completed', 'startedAt', 'scenario',
]

/** Puts a field in quotes when it has a comma, a quote, or a line break (RFC 4180). */
const field = (v: unknown) => {
  const s = String(v)
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

export function toCsv(records: TaskRecord[]): string {
  return [COLUMNS, ...records.map((r) => COLUMNS.map((c) => r[c] ?? ''))].map((row) => row.map(field).join(',')).join('\r\n')
}

export type Summary = {
  mode: Mode
  tasks: number
  medianSignals: number
  minSignals: number
  maxSignals: number
  medianMs: number
  minMs: number
  maxMs: number
  topRate: number
  top5Rate: number
}

export function median(xs: number[]): number {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

/** Gives one summary for each mode. It uses only completed records of the 10 tasks, so help tests, hold-out tasks, and Gate A runs do not change the medians. */
export function summarize(records: TaskRecord[]): Summary[] {
  const byMode = new Map<Mode, TaskRecord[]>()
  for (const r of records) if (r.completed && typeof r.task === 'number') byMode.set(r.mode, [...(byMode.get(r.mode) ?? []), r])
  return [...byMode].map(([mode, rs]) => {
    const signals = rs.map((r) => r.signals)
    const ms = rs.map((r) => r.ms)
    const steps = sum(rs.map((r) => r.steps))
    return {
      mode,
      tasks: rs.length,
      medianSignals: median(signals),
      minSignals: Math.min(...signals),
      maxSignals: Math.max(...signals),
      medianMs: median(ms),
      minMs: Math.min(...ms),
      maxMs: Math.max(...ms),
      topRate: steps ? sum(rs.map((r) => r.topHits)) / steps : 0,
      top5Rate: steps ? sum(rs.map((r) => r.top5Hits)) / steps : 0,
    }
  })
}

/** Percent fewer signals than baseline, as an integer. */
export function savingPct(baseline: number, other: number): number {
  return baseline ? Math.round(((baseline - other) / baseline) * 100) : 0
}

/** One ID for each page load. All records of one visit share it. */
export const SESSION = Date.now().toString(36)

/** The tester name for the log. An empty name gives "unnamed", so every run is still logged. */
export const testerName = (name: string) => name.trim() || 'unnamed'

const KEY = 'transcendent.log'

export function loadLog(): TaskRecord[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export function saveLog(records: TaskRecord[]): void {
  if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(records))
}
