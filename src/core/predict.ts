// Tier 0 predictor (T6): rules on the workspace state plus counts of past selections. No model, no network.

import { validActions, type Action, type Workspace } from './workspace'

export type Counts = Record<string, number>

/** The key ignores the target, so a habit applies to all targets of the same app and verb. */
export function countKey(a: Action): string {
  return `${a.app}:${a.verb}`
}

const COUNT_WEIGHT = 5

/** The rule score of one action. A high score ranks first. */
function score(ws: Workspace, a: Action, goUseful: boolean): number {
  const mail = ws.mails.find((m) => m.id === a.target)
  switch (a.verb) {
    case 'go':
      return goUseful ? 20 : 0
    case 'next-page':
      return 50
    case 'accept':
      return 45
    case 'add-event':
      return 44
    case 'decline':
      return 43
    case 'archive':
      return mail?.readToEnd ? 40 : 20
    case 'reply':
      if (a.app === 'mail') return mail?.readToEnd ? 39 : 20
      return 40
    case 'back':
      return 30
    case 'open':
      if (a.app === 'mail') return mail?.unread ? 30 : 20
      if (a.app === 'messages') return ws.threads.find((t) => t.id === a.target)?.messages.at(-1)?.from === 'them' ? 30 : 20
      return 20
    case 'toggle-todo':
      return ws.todos.find((t) => t.id === a.target)?.done ? 5 : 30
    case 'search':
    case 'new-note':
      return 30
    default:
      return 10
  }
}

/** Returns all valid actions except "Call for help", best first. Delete actions are always last. */
export function rankActions(ws: Workspace, counts: Counts): Action[] {
  const list = validActions(ws).filter((a) => a.verb !== 'help')
  // The go actions rank high only when the current app has no useful action, for example in the calendar.
  const goUseful = !list.some((a) => a.app === ws.view.app && a.verb !== 'go' && a.verb !== 'delete')
  const total = (a: Action) => score(ws, a, goUseful) + COUNT_WEIGHT * Math.log1p(counts[countKey(a)] ?? 0)
  const scored = list.map((a) => ({ a, last: a.verb === 'delete', s: total(a) }))
  // Array sort is stable, so ties keep the validActions order.
  scored.sort((x, y) => Number(x.last) - Number(y.last) || y.s - x.s)
  return scored.map((x) => x.a)
}
