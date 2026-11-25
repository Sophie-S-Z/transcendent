// The scan: the highlight moves through a list of items, and one select runs the highlighted item.
// The web app, the extension and the desktop app use these two hooks.
import { useEffect, useRef, useState } from 'react'

/** The current screen ("layer") and the highlighted item. go shows a new layer from its first item. */
export function useScan<L extends { kind: string }>(initial: L) {
  const [layer, setLayer] = useState(initial)
  const [index, setIndex] = useState(0)
  const [version, setVersion] = useState(0)
  // Timers and async callbacks read the current layer from this ref.
  const now = useRef(layer)
  useEffect(() => {
    now.current = layer
  })
  /** Starts the scan again on the first item. A new version also restarts the step timer. */
  const restart = () => {
    setIndex(0)
    setVersion((v) => v + 1)
  }
  const go = (next: L) => {
    setLayer(next)
    restart()
  }
  return { layer, index, setIndex, version, go, restart, now }
}

/**
 * Moves the highlight one item each stepMs, in a loop.
 * In a keyboard row (a layer with a row number), one full pass with no select returns to the row list.
 */
export function useScanTimer<L extends { kind: string }>(scan: ReturnType<typeof useScan<L>>, count: number, stepMs: number, stopped: boolean) {
  const latest = useRef({ scan, count })
  useEffect(() => {
    latest.current = { scan, count }
  })
  useEffect(() => {
    if (stopped) return
    const id = setInterval(() => {
      const { scan: s, count: n } = latest.current
      const l = s.layer as L & { row?: number | null }
      if (s.index + 1 >= n && l.row != null) s.go({ ...l, row: null })
      else s.setIndex((s.index + 1) % n)
    }, stepMs)
    return () => clearInterval(id)
  }, [scan.version, stopped, stepMs])
}
