/// <reference types="chrome" />
// The content script. The side panel injects it into the active tab only when the caregiver allowed that site.
// It reads the page into action records, draws the highlight, runs actions, and forwards keys.
// The element map stays here. The panel only sees records. Nothing leaves the laptop.
import { allowedWithPayments, FIXED, isCardField, mergeLabel, PAYMENT_NOTICE, riskOf, type PageAction, type PageState } from './page'

/** What the panel sends. */
export type ToPage =
  | { type: 'read' }
  | { type: 'highlight'; id: string | null }
  | { type: 'run'; id: string; label: string; confirmed: boolean; text?: string }
/** What the page sends back. `done` has an empty error when the action ran. */
export type FromPage = { type: 'state'; state: PageState } | { type: 'key'; key: 'select' | 'stop' } | { type: 'done'; error: string }

declare global {
  var __transcendent: boolean | undefined
}

// The panel can inject the script more than once into the same page. It sets up only once.
if (!globalThis.__transcendent) {
  globalThis.__transcendent = true
  setup()
}

function setup() {
  const SELECTOR = 'a[href], button, input, textarea, [role=button], [role=link], h1, h2, h3'
  const CLICKABLE = 'a[href], button, [role=button], [role=link]'
  const ids = new WeakMap<Element, string>()
  let nextId = 1
  let elements = new Map<string, HTMLElement>()
  let port: chrome.runtime.Port | null = null
  let highlighted: string | null = null

  const text = (el: Element | null) => ((el as HTMLElement | null)?.innerText ?? '').replace(/\s+/g, ' ').trim()
  const attr = (el: Element, name: string) => el.getAttribute(name)?.trim() ?? ''
  const isField = (el: Element): el is HTMLInputElement | HTMLTextAreaElement =>
    el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && ['text', 'search', 'email'].includes(el.type))
  const isInputButton = (el: Element): el is HTMLInputElement =>
    el instanceof HTMLInputElement && ['submit', 'button', 'reset', 'image'].includes(el.type)
  const fieldLabel = (el: HTMLInputElement | HTMLTextAreaElement) => [...(el.labels ?? [])].map(text).join(' ')

  /** True when a person can see the element and it is the one on top at its center. */
  function shown(el: HTMLElement): boolean {
    if (el.closest('[inert], [aria-hidden="true"]')) return false
    if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false
    // Nearly transparent counts as hidden.
    let opacity = 1
    for (let e: Element | null = el; e; e = e.parentElement) opacity *= Number(getComputedStyle(e).opacity)
    if (opacity < 0.1) return false
    const r = el.getBoundingClientRect()
    if (r.width < 8 || r.height < 8) return false
    const x = r.left + r.width / 2
    const y = r.top + r.height / 2
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return false
    const top = document.elementFromPoint(x, y)
    return !!top && (top === el || el.contains(top) || (top instanceof HTMLLabelElement && top.control === el))
  }

  const cardFieldOn = (el: HTMLInputElement) =>
    isCardField({ autocomplete: attr(el, 'autocomplete'), name: el.name, id: el.id, label: fieldLabel(el), placeholder: el.placeholder })

  /** True when the page asks for card details: a card field, or a frame from a payment provider. */
  const hasCardField = () =>
    [...document.querySelectorAll('input')].some((el) => el.checkVisibility() && cardFieldOn(el)) ||
    [...document.querySelectorAll('iframe')].some((f) => /card|payment|stripe|braintree|adyen/i.test(`${f.title} ${f.name} ${f.src}`))

  /** One action record for an element, or null when it is not a valid action. */
  function record(el: HTMLElement): PageAction | null {
    const heading = /^H[1-3]$/.test(el.tagName)
    const field = isField(el)
    if (!heading && !field && !isInputButton(el) && el instanceof HTMLInputElement) return null
    if ((el as HTMLButtonElement).disabled || attr(el, 'aria-disabled') === 'true') return null
    if (field && el.readOnly) return null
    if (!heading && !field && el.parentElement?.closest(CLICKABLE)) return null
    if (!shown(el)) return null

    const labelledBy = attr(el, 'aria-labelledby')
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => text(document.getElementById(id)))
      .join(' ')
    const visible = field
      ? fieldLabel(el) || el.placeholder
      : isInputButton(el)
        ? el.value || el.alt
        : text(el) || (el.querySelector('img[alt]') as HTMLImageElement | null)?.alt || ''
    const name = labelledBy || attr(el, 'aria-label') || visible || attr(el, 'title')
    let id = ids.get(el)
    if (!id) ids.set(el, (id = `e${nextId++}`))
    elements.set(id, el)
    const region = el.closest('main, [role=main]')
      ? 'main'
      : el.closest('nav, header, footer, aside, [role=navigation], [role=banner], [role=contentinfo], [role=complementary]')
        ? 'nav'
        : 'other'
    if (heading) return { id, kind: 'scroll', label: `Go to: ${mergeLabel(visible, name)}`, risk: 'safe', region }
    const label = mergeLabel(visible, name)
    if (field) {
      const active = document.activeElement
      const fill = !el.value && (el === active || (!!el.form && !!active && el.form.contains(active)))
      return { id, kind: 'type', label: `Write in: ${label}`, risk: 'safe', region, fill }
    }
    // A submit button also carries the names of its form, so a form named "Send" makes it irreversible.
    const form = (el as HTMLButtonElement).form
    const submits = !!form && (isInputButton(el) ? el.type === 'submit' || el.type === 'image' : el instanceof HTMLButtonElement && el.type === 'submit')
    const names = [visible, name, labelledBy, attr(el, 'aria-label'), attr(el, 'title'), attr(el, 'value'), attr(el, 'alt')]
    if (submits) names.push(attr(form, 'aria-label'), attr(form, 'name'), attr(form, 'id'), attr(form, 'action'))
    const context = submits
      ? { password: !!form.querySelector('input[type=password]'), payment: [...form.querySelectorAll('input')].some(cardFieldOn) }
      : null
    return { id, kind: 'click', label, risk: riskOf(names, context), region }
  }

  function read(): PageState {
    elements = new Map()
    const actions = [...document.querySelectorAll<HTMLElement>(SELECTOR)].flatMap((el) => record(el) ?? [])
    return { actions: [...actions, ...FIXED], payments: hasCardField() }
  }

  // The highlight: an outline in a closed shadow root, so page styles and scripts cannot change it.
  const host = document.createElement('transcendent-highlight')
  const shadow = host.attachShadow({ mode: 'closed' })
  const style = document.createElement('style')
  style.textContent = `:host{all:initial!important;position:fixed!important;inset:0!important;pointer-events:none!important;
z-index:2147483647!important;display:block!important}
div{position:fixed;box-sizing:border-box;border:4px solid #e8a33d;border-radius:10px;box-shadow:0 0 0 4px rgba(0,0,0,.55);
pointer-events:none;transition:all 120ms ease-out}`
  const box = document.createElement('div')
  shadow.append(style, box)

  function place() {
    const el = highlighted ? elements.get(highlighted) : undefined
    if (!el?.isConnected) return host.remove()
    const r = el.getBoundingClientRect()
    Object.assign(box.style, { left: `${r.left - 6}px`, top: `${r.top - 6}px`, width: `${r.width + 12}px`, height: `${r.height + 12}px` })
    if (!host.isConnected) document.documentElement.append(host)
  }

  function highlight(id: string | null) {
    highlighted = id
    if (id) elements.get(id)?.scrollIntoView({ block: 'nearest' })
    place()
  }

  /** Runs one action. Returns an empty string, or the reason it did not run. */
  function run(msg: Extract<ToPage, { type: 'run' }>): string {
    const state = read()
    const a = state.actions.find((x) => x.id === msg.id)
    if (!a || a.label !== msg.label) return 'The page changed, so that item is gone. Look at the new list.'
    if (state.payments && !allowedWithPayments(a.kind)) return PAYMENT_NOTICE
    if (a.risk === 'irreversible' && !msg.confirmed) return 'The page changed this item. Look at the new list.'
    const el = elements.get(a.id)
    if (a.id === 'scroll-down' || a.id === 'scroll-up') scrollBy({ top: (a.id === 'scroll-down' ? 0.85 : -0.85) * innerHeight })
    else if (a.kind === 'back') history.back()
    else if (a.kind === 'scroll') el?.scrollIntoView({ block: 'start' })
    else if (a.kind === 'click') {
      el?.focus()
      el?.click()
    } else if (a.kind === 'type' && el && isField(el)) {
      // The native setter and input events let page frameworks see the new text.
      el.focus()
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, msg.text ?? '')
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    return ''
  }

  const send = (msg: FromPage) => port?.postMessage(msg)

  // The list is built again 300 ms after the page stops changing, and after a scroll.
  let timer = 0
  const changed = () => {
    clearTimeout(timer)
    timer = window.setTimeout(() => port && send({ type: 'state', state: read() }), 300)
  }
  const observer = new MutationObserver((records) => {
    if (records.every((r) => [...r.addedNodes, ...r.removedNodes].every((n) => n === host) && r.type === 'childList')) return
    changed()
  })
  addEventListener('scroll', () => (place(), changed()), { capture: true, passive: true })
  addEventListener('resize', () => (place(), changed()))

  // While the panel is connected, keys on the page are signals: Escape stops, any other key selects.
  addEventListener(
    'keydown',
    (e) => {
      if (!port || e.ctrlKey || e.metaKey || e.altKey) return
      e.preventDefault()
      e.stopImmediatePropagation()
      if (e.repeat) return
      if (e.key === 'Escape') highlight(null)
      send({ type: 'key', key: e.key === 'Escape' ? 'stop' : 'select' })
    },
    true,
  )

  chrome.runtime.onConnect.addListener((p) => {
    if (p.name !== 'transcendent') return
    port?.disconnect()
    port = p
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true })
    p.onMessage.addListener((msg: ToPage) => {
      if (msg.type === 'read') send({ type: 'state', state: read() })
      if (msg.type === 'highlight') highlight(msg.id)
      if (msg.type === 'run') {
        highlight(null)
        send({ type: 'done', error: run(msg) })
        changed()
      }
    })
    p.onDisconnect.addListener(() => {
      if (port !== p) return
      port = null
      observer.disconnect()
      highlight(null)
    })
  })
}
