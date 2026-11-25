// Tier 1 predictor: a small open model in the browser (WebLLM) ranks the list of valid actions.
// The model only ranks the given list. filterValid drops every ID that is not valid.
// The extension uses rankList with a description of the web page.

import type { MLCEngineInterface } from '@mlc-ai/web-llm'
import { useEffect, useRef, useState } from 'react'
import { filterValid, type Action, type Workspace } from './workspace'

export type Engine = MLCEngineInterface

export const MODEL_ID = 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC'

/** A short description of the current view. */
function describe(ws: Workspace): string {
  const { app, open, page, query } = ws.view
  if (app === 'mail' && open) {
    const m = ws.mails.find((x) => x.id === open)
    if (m) return `Email from ${m.from}, "${m.subject}", page ${page + 1} of ${m.pages.length}: ${m.pages[page]}`
  }
  if (app === 'messages' && open) {
    const t = ws.threads.find((x) => x.id === open)
    if (t) return `Chat with ${t.contact}. Last message: ${t.messages.at(-1)?.text ?? 'none'}`
  }
  if (app === 'notes' && open) {
    const n = ws.notes.find((x) => x.id === open)
    if (n) return `Note "${n.title}": ${n.body}`
  }
  return `The ${app} list${query ? `, search "${query}"` : ''}.`
}

/** Builds the prompt: a short description of the screen, and the numbered list of action labels (excluding help). Asks for the best 5 numbers, comma-separated, best first, and nothing else. The web app and the extension share it. */
export function rankPrompt(description: string, labels: string[]): string {
  const list = labels.map((label, i) => `${i + 1}. ${label}`).join('\n')
  return `The user sees: ${description}\n\nActions:\n${list}\n\nWhich 5 actions will the user most likely choose next? Answer with 5 numbers, comma-separated, best first, and nothing else.`
}

/** Parses the model output: takes integers in order, maps 1-based numbers to action IDs, drops numbers out of range and duplicates. Never throws. */
export function parseRanking(output: string, actions: { id: string }[]): string[] {
  const ids = (output.match(/\d+/g) ?? []).flatMap((n) => actions[Number(n) - 1]?.id ?? [])
  return [...new Set(ids)]
}

/** Loads the engine with a progress callback. Import @mlc-ai/web-llm with a dynamic import() so the main bundle stays small. */
export async function loadEngine(onProgress: (text: string) => void): Promise<Engine> {
  const { CreateMLCEngine } = await import('@mlc-ai/web-llm')
  return CreateMLCEngine(MODEL_ID, { initProgressCallback: (p) => onProgress(p.text) })
}

/** Asks the model to rank the listed actions, with temperature 0 and max_tokens about 20. Returns only listed IDs, best first. */
export async function rankList(engine: Engine, description: string, actions: { id: string; label: string }[]): Promise<string[]> {
  const reply = await engine.chat.completions.create({
    messages: [{ role: 'user', content: rankPrompt(description, actions.map((a) => a.label)) }],
    temperature: 0,
    max_tokens: 20,
  })
  return parseRanking(reply.choices[0]?.message.content ?? '', actions)
}

/** Ranks the workspace actions. Returns valid IDs, best first, through filterValid. */
export async function rankWithModel(engine: Engine, ws: Workspace, actions: Action[]): Promise<string[]> {
  return filterValid(ws, await rankList(engine, describe(ws), actions)).map((a) => a.id)
}

const MODEL_WAIT_MS = 1500

/**
 * Asks the model each time key changes, and returns its IDs for the current key.
 * Returns null while the model works, and [] with no engine. After 1.5 s the model stops and the answer is [], so Tier 0 ranks.
 * onAnswer runs after each answer. A new key or an unmount stops the open request.
 */
export function useModelRanking(engine: Engine | null, key: unknown, ask: (engine: Engine) => Promise<string[]>, onAnswer: () => void) {
  const [answer, setAnswer] = useState<{ key: unknown; ids: string[] } | null>(null)
  const latest = useRef({ ask, onAnswer })
  useEffect(() => {
    latest.current = { ask, onAnswer }
  })
  useEffect(() => {
    if (!engine) return
    let live = true
    let pending = true
    let timer = 0
    const timeout = new Promise<null>((resolve) => {
      timer = window.setTimeout(() => resolve(null), MODEL_WAIT_MS)
    })
    Promise.race([latest.current.ask(engine), timeout])
      .catch(() => [])
      .then((ids) => {
        if (ids === null) engine.interruptGenerate()
        pending = false
        clearTimeout(timer)
        if (!live) return
        setAnswer({ key, ids: ids ?? [] })
        latest.current.onAnswer()
      })
    return () => {
      live = false
      clearTimeout(timer)
      if (pending) engine.interruptGenerate()
      pending = false
    }
  }, [engine, key])
  if (!engine) return []
  return answer && answer.key === key ? answer.ids : null
}
