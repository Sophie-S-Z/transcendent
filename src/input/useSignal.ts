import { useEffect, useRef, useState } from 'react'
import { initialBlink, stepBlink, type BlinkConfig } from './blink'
import { useFaceBlink } from './useFaceBlink'

const NO_FACE_PAUSE_MS = 2000

/**
 * One "select" signal from a held blink or from any key (T3).
 * The app pauses when the camera sees no face for 2 seconds (T4).
 * During the pause, the next select only ends the pause.
 */
export function useSignal(onSelect: () => void, blink: BlinkConfig, camera: boolean) {
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const machine = useRef(initialBlink)
  const lastFace = useRef<number | null>(null)
  const pausedRef = useRef(false)
  const onSelectRef = useRef(onSelect)
  useEffect(() => {
    onSelectRef.current = onSelect
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
    machine.current = r.state
    setProgress(r.progress)
    if (r.select) signal()
  }, camera)

  return { videoRef, status, error, progress, paused }
}
