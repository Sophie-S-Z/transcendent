import { useEffect, useRef, useState } from 'react'
import { initialBlink, stepBlink, type BlinkConfig } from './blink'
import { stepHold } from './hold'
import { useFaceBlink } from './useFaceBlink'

const NO_FACE_PAUSE_MS = 2000

/**
 * One "select" signal from a held blink or from any key (T3).
 * The app pauses when the camera sees no face for 2 seconds (T4).
 * During the pause, the next select only ends the pause.
 * With onLong, a held blink selects when the eyes open, and a hold of 3 seconds calls onLong and selects nothing.
 */
export function useSignal(onSelect: () => void, blink: BlinkConfig, camera: boolean, onLong?: () => void) {
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const machine = useRef(initialBlink)
  const hold = useRef({ start: 0, toggled: false })
  const lastFace = useRef<number | null>(null)
  const pausedRef = useRef(false)
  const onSelectRef = useRef(onSelect)
  const onLongRef = useRef(onLong)
  useEffect(() => {
    onSelectRef.current = onSelect
    onLongRef.current = onLong
  })

  const signal = () => {
    if (pausedRef.current) {
      pausedRef.current = false
      lastFace.current = null
      setPaused(false)
    } else onSelectRef.current()
  }
  const signalRef = useRef(signal)
  useEffect(() => {
    signalRef.current = signal
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.target instanceof HTMLInputElement) return
      e.preventDefault()
      signalRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const { videoRef, status, error } = useFaceBlink(({ t, score }) => {
    if (score === null) {
      setProgress(0)
      machine.current = initialBlink
      lastFace.current ??= t
      if (!pausedRef.current && t - lastFace.current >= NO_FACE_PAUSE_MS) {
        pausedRef.current = true
        setPaused(true)
      }
      return
    }
    lastFace.current = t
    const r = stepBlink(machine.current, score, t, blink)
    setProgress(r.progress)
    if (onLongRef.current) {
      const h = stepHold(hold.current, machine.current.phase, r.state.phase, t)
      hold.current = h.hold
      if (h.action === 'press') signal()
      if (h.action === 'toggle') onLongRef.current()
    } else if (r.select) signal()
    machine.current = r.state
  }, camera)

  return { videoRef, status, error, progress, paused }
}
