import { LiquidMetal, MeshGradient } from '@paper-design/shaders-react'

// Paper Shaders (Apache-2.0). Speed 0 draws one frame and stops, so the backdrop costs nothing while the camera runs.

/** A dark, grainy navy field behind every screen. */
export function Backdrop() {
  return (
    <MeshGradient
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10"
      colors={['#0a1022', '#142450', '#0a1022', '#1f3a6a']}
      distortion={0.9}
      swirl={0.35}
      grainOverlay={0.25}
      speed={0}
      frame={9000}
    />
  )
}

const still = matchMedia('(prefers-reduced-motion: reduce)').matches

/** The liquid chrome mark. Use it only on screens without the camera, because it animates. */
export function Mark({ size }: { size: number }) {
  return (
    <LiquidMetal
      aria-hidden
      style={{ width: size, height: size }}
      shape="circle"
      colorBack="#00000000"
      colorTint="#c9dcff"
      scale={0.9}
      speed={still ? 0 : 0.6}
    />
  )
}
