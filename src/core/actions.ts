// Pure parts that the extension and the desktop app share: labels, the risk check, and the Tier 0 ranker for
// actions that a reader finds on a web page or in an app window. No DOM access here, so tests run in node.

export type Risk = 'safe' | 'irreversible'
export type Region = 'main' | 'nav' | 'other'
/** The fields the ranker uses. `fill` marks an empty field in the form that has focus. */
export type Ranked = { label: string; risk: Risk; region: Region; fill?: boolean }

const LABEL_MAX = 40
const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

/** Cuts a label to `max` characters, with an ellipsis. */
export function clip(s: string, max = LABEL_MAX): string {
  const t = norm(s)
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t
}

/**
 * The card label from the visible text and the accessible name.
 * When the name only adds words to the visible text, the label is the name.
 * When they disagree, the label shows both, so a page cannot hide what a button does.
 */
export function mergeLabel(visible: string, name: string): string {
  const v = norm(visible)
  const n = norm(name)
  if (!v || !n) return clip(v || n)
  if (n.toLowerCase() === v.toLowerCase()) return clip(v)
  if (n.toLowerCase().includes(v.toLowerCase())) return clip(n)
  return `${clip(v, 18)} (page names it: ${clip(n, 18)})`
}

const RISKY = /\b(send|post|publish|pay|buy|order|purchase|checkout|check out|delete|remove|submit|transfer|confirm)\b/i

/**
 * The risk of a click. Any name with a risky word, or a submit in a form with a password or card field, is irreversible.
 * `names` holds every name of the element (visible text, aria-label, value, title) and of its form when it submits one.
 */
export function riskOf(names: string[], submit: { password: boolean; payment: boolean } | null): Risk {
  if (names.some((n) => RISKY.test(n))) return 'irreversible'
  return submit && (submit.password || submit.payment) ? 'irreversible' : 'safe'
}

const REGION_ORDER: Record<Region, number> = { main: 0, nav: 1, other: 2 }

/**
 * Tier 0 for pages and app windows. Empty fields of the form that has focus come first, in page order.
 * Then the actions this user chose most often on this site, then main content before navigation.
 * Irreversible actions are always last. Ties keep the page order.
 */
export function rankTier0<A extends Ranked>(actions: A[], counts: Record<string, number>): A[] {
  const key = (a: A) => [Number(a.risk === 'irreversible'), Number(!a.fill), -(counts[a.label] ?? 0), REGION_ORDER[a.region]]
  return actions
    .map((a) => ({ a, k: key(a) }))
    .sort((x, y) => x.k.reduce((d, v, i) => d || v - y.k[i], 0))
    .map((x) => x.a)
}
