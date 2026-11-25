import { LiquidMetal, MeshGradient } from '@paper-design/shaders-react'

// Paper Shaders (Apache-2.0). Speed 0 draws one frame and stops, so a still backdrop costs nothing while the camera runs.

const still = matchMedia('(prefers-reduced-motion: reduce)').matches

/** A dark, grainy pine field behind every screen. It drifts slowly only when `live` is true. */
export function Backdrop({ live }: { live: boolean }) {
  return (
    <MeshGradient
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10"
      colors={['#0a1c1b', '#123430', '#081716', '#1d3d31']}
      distortion={0.9}
      swirl={0.35}
      grainMixer={0.15}
      grainOverlay={0.35}
      speed={live && !still ? 0.08 : 0}
      frame={9000}
      minPixelRatio={1}
      maxPixelCount={1920 * 1080}
    />
  )
}

/** The liquid metal mark, tinted sage. Use it only on screens without the camera, because it animates. */
export function Mark({ size }: { size: number }) {
  return (
    <LiquidMetal
      aria-hidden
      style={{ width: size, height: size }}
      shape="circle"
      colorBack="#00000000"
      colorTint="#cae6d3"
      scale={0.9}
      speed={still ? 0 : 0.6}
    />
  )
}
