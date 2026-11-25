// Text entry for actions that need text. It gives three levels: complete drafts, next-word suggestions,
// and a row-column scanning keyboard. The keyboard alone is also the baseline for the evaluation.

import type { Action, Workspace } from '../core/workspace'

/** Up to 3 complete drafts for a text action: mail drafts for mail reply/decline, thread drafts for messages reply, [] for new-note and search. */
export function draftsFor(ws: Workspace, action: Action): string[] {
  if (action.app === 'mail') return (ws.mails.find((m) => m.id === action.target)?.drafts ?? []).slice(0, 3)
  if (action.app === 'messages') return (ws.threads.find((t) => t.id === action.target)?.drafts ?? []).slice(0, 3)
  return []
}

export const SPACE = '␣'
export const DELETE = '⌫'
export const DONE = '✓'

/** Keyboard rows for row-column scanning. Letters ordered by English letter frequency (ETAOINSHRDLCUMWFGYPBVKJXQZ), then special keys. */
export const KEY_ROWS: string[][] = [
  [SPACE, 'e', 't', 'a', DELETE, DONE],
  ['o', 'i', 'n', 's', 'h', 'r'],
  ['d', 'l', 'c', 'u', 'm', 'w'],
  ['f', 'g', 'y', 'p', 'b', 'v'],
  ['k', 'j', 'x', 'q', 'z'],
  ['.', ',', '?'],
]

/** Applies one key to the text. SPACE adds a space, DELETE removes the last character; DONE does not change the text. */
export function typeKey(text: string, key: string): string {
  if (key === SPACE) return `${text} `
  if (key === DELETE) return text.slice(0, -1)
  if (key === DONE) return text
  return text + key
}

/**
 * The scan items for text entry. With no open row, the items are the rows. In an open row, the items are its keys.
 * set gets the new text and the open row. DONE calls done when the text is not empty.
 */
export function keyItems(text: string, row: number | null, set: (text: string, row: number | null) => void, done: () => void) {
  if (row === null) return KEY_ROWS.map((r, i) => ({ label: r.join(' '), run: () => set(text, i) }))
  return KEY_ROWS[row].map((k) => ({ label: k, run: () => (k !== DONE ? set(typeKey(text, k), null) : text.trim() && done()) }))
}

// Common English words, most frequent first. They give the model a start before the workspace text.
const COMMON = `the be to of and a in that have i it for not on with he as you do at this but his by from they we
say her she or an will my one all would there their what so up out if about who get which go me when make can like
time no just him know take people into year your good some could them see other than then now look only come its
over think also back after use two how our work first well way even new want because any these give day most us is
am are was yes please thank thanks help need water call talk tomorrow today tonight here where why ok sorry
later soon home feel pain tired hungry cold hot bed sleep book meet meeting doctor`

const tokens = (s: string) => s.toLowerCase().match(/[a-z']+/g) ?? []
const show = (w: string) => (w === 'i' ? 'I' : w)

function workspaceTexts(ws: Workspace): string[] {
  return [
    ...ws.mails.flatMap((m) => [m.subject, ...m.pages, ...m.drafts]),
    ...ws.threads.flatMap((t) => [...t.messages.map((m) => m.text), ...t.drafts]),
    ...ws.notes.flatMap((n) => [n.title, n.body]),
  ]
}

/** Up to 4 next-word suggestions for the current text. If the text ends inside a word, complete that word; otherwise predict the next word. */
export function nextWords(text: string, ws: Workspace): string[] {
  const uni = new Map<string, number>()
  const bi = new Map<string, Map<string, number>>()
  const add = (m: Map<string, number>, w: string) => m.set(w, (m.get(w) ?? 0) + 1)
  for (const w of tokens(COMMON)) add(uni, w)
  // Sentences are separate, so a bigram does not cross a sentence end.
  for (const sentence of workspaceTexts(ws).flatMap((t) => t.split(/[.?!]/))) {
    const t = tokens(sentence)
    for (let i = 0; i < t.length; i++) {
      add(uni, t[i])
      if (i === 0) continue
      const followers = bi.get(t[i - 1]) ?? new Map<string, number>()
      bi.set(t[i - 1], add(followers, t[i]))
    }
  }
  const ranked = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1]).map(([w]) => w)

  const all = tokens(text)
  const inWord = /[a-z']$/i.test(text)
  const partial = inWord ? all[all.length - 1] : ''
  const candidates = inWord
    ? ranked(uni).filter((w) => w.startsWith(partial) && w !== partial)
    : [...ranked(bi.get(all[all.length - 1]) ?? new Map()), ...ranked(uni)]
  return [...new Set(candidates)].slice(0, 4).map(show)
}

/** Replaces the partial last word with `word` and adds a space. */
export function acceptWord(text: string, word: string): string {
  return `${text.replace(/[a-z']+$/i, '')}${word} `
}
