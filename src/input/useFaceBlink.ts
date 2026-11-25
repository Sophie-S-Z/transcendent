import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import { useEffect, useRef, useState } from 'react'
import { eyeScore } from './blink'

export type FaceFrame = { t: number; score: number | null; detectMs: number }
export type FaceStatus = 'loading' | 'ready' | 'error'

const base = import.meta.env.BASE_URL

async function createLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(`${base}mediapipe`)
  return FaceLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: `${base}models/face_landmarker.task`, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numFaces: 1,
    outputFaceBlendshapes: true,
  })
}

function blinkScore(result: ReturnType<FaceLandmarker['detectForVideo']>): number | null {
  const shapes = result.faceBlendshapes[0]?.categories
  if (!shapes) return null
  const get = (name: string) => shapes.find((c) => c.categoryName === name)?.score ?? 0
  return eyeScore(get('eyeBlinkLeft'), get('eyeBlinkRight'))
}

/**
 * Opens the camera and runs Face Landmarker on each new video frame, on the device.
 * Calls onFrame with the blink score, or null when no face is in view. Does nothing when enabled is false.
 * No frame leaves the browser.
 */
export function useFaceBlink(onFrame: (f: FaceFrame) => void, enabled = true) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<FaceStatus>('loading')
  const [error, setError] = useState('')
  const onFrameRef = useRef(onFrame)
  useEffect(() => {
    onFrameRef.current = onFrame
  })

  useEffect(() => {
    if (!enabled) return
    let stopped = false
    let stream: MediaStream | undefined
    let landmarker: FaceLandmarker | undefined
    let raf = 0
    // Stops the camera and frees the model. It is safe to call more than one time.
    const release = () => {
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((track) => track.stop())
      landmarker?.close()
      landmarker = undefined
    }

    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })
        if (stopped) return release()
        landmarker = await createLandmarker()
        const video = videoRef.current
        if (stopped || !video) return release()
        video.srcObject = stream
        await video.play()
        setStatus('ready')
        let lastTime = -1
        const loop = () => {
          if (stopped) return
          if (video.currentTime !== lastTime) {
            lastTime = video.currentTime
            const t = performance.now()
            const score = blinkScore(landmarker!.detectForVideo(video, t))
            onFrameRef.current({ t, score, detectMs: performance.now() - t })
          }
          raf = requestAnimationFrame(loop)
        }
        loop()
      } catch (e) {
        release()
        if (stopped) return
        setError(e instanceof Error ? e.message : String(e))
        setStatus('error')
      }
    })()

    return () => {
      stopped = true
      release()
    }
  }, [enabled])

  return { videoRef, status, error }
}
