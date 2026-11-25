// Pure parts of Predict mode: app controls to ranked actions, the list-change check, the groups, and the CSV log.
// No DOM access and no Tauri call here, so the tests run in node.

import { clip, riskOf, type Ranked, type Region, type Risk } from '../../src/core/actions'

export type Kind = 'invoke' | 'toggle' | 'select' | 'expand' | 'type' | 'focus'
/** One control as the Rust reader sends it. A password field has the kind 'type' and `password` true. */
export type Control = { id: string; kind: Kind; label: string; names: string[]; region: Region; fill: boolean; password: boolean }
/** The window that the reader read. `elevated` is true when the app may run as administrator. */
export type AppWindow = { title: string; process: string; elevated: boolean; controls: Control[] }
/** One item for the scan. `name` is the label from the reader. run_action checks it again. */
export type AppAction = Ranked & { id: string; kind: Kind; name: string; password: boolean }
export type LogRow = { time: string; app: string; label: string; risk: Risk }

const PREFIX: Record<Kind, string> = {
  invoke: '',
  toggle: '',
  select: '',
  expand: 'Open or close: ',
  type: 'Write in: ',
  focus: 'Put the cursor in: ',
}

/** Turns the controls into scan items. Any name with a risky word makes the item irreversible, so it goes to the confirm screen. */
export function toActions(controls: Control[]): AppAction[] {
  return controls.map((c) => {
    // The app never types into a password field. It only puts the cursor there.
    const kind = c.password ? 'focus' : c.kind
    return {
      id: c.id,
      kind,
      name: c.label,
      label: PREFIX[kind] + clip(c.label),
      risk: riskOf([c.label, ...c.names], null),
      region: c.region,
      fill: c.fill,
      password: c.password,
    }
  })
}

/** A new signature means a new list, and the scan starts again. */
export const signature = (controls: Control[]) => controls.map((c) => `${c.id}:${c.label}`).join('|')

/** The message for a window that the app cannot read, or '' when the read worked. */
export function readProblem(w: AppWindow): string {
  if (w.controls.length) return ''
  const name = w.title || w.process
  return w.elevated ? `Transcendent cannot read ${name}. It may run as administrator.` : `Transcendent found no controls in ${name}.`
}

const safe = (kind: Kind) => (a: AppAction) => a.kind === kind && a.risk === 'safe'

/** "Something else" groups every item by kind. */
export const GROUPS: [string, (a: AppAction) => boolean][] = [
  ['Buttons', safe('invoke')],
  ['On and off switches', safe('toggle')],
  ['Items to choose', safe('select')],
  ['Menus and lists to open', safe('expand')],
  ['Write in a field', safe('type')],
  ['Put the cursor in a field', safe('focus')],
  ['Send, buy, or delete', (a) => a.risk === 'irreversible'],
]

