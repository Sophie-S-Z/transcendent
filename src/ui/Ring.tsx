/** The ring that closes around a target while the user holds a blink. `progress` is 0 to 1. */
export function Ring({ progress, size = 160, glow = false }: { progress: number; size?: number; glow?: boolean }) {
  const r = size / 2 - 8
  const c = 2 * Math.PI * r
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden
      className={`transition-[filter] duration-200 ${glow ? 'drop-shadow-[0_0_16px_var(--color-accent)]' : ''}`}
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-line)" strokeWidth={12} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth={12}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - progress)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  )
}
