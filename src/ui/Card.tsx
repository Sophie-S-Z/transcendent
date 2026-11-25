/**
 * One scan item. The highlighted card lights up in sage. During a held blink a ring closes around it.
 */
export function Card({
  label,
  highlight,
  progress,
  large = false,
  urgent = false,
}: {
  label: string
  highlight: boolean
  progress: number
  large?: boolean
  /** True for "Call for help". An amber edge sets it apart from the other items. */
  urgent?: boolean
}) {
  return (
    <div
      data-item
      data-highlight={highlight || undefined}
      className={`relative flex h-full items-center rounded-(--radius-item) border px-6 transition-[scale,background-color,color] duration-200 ease-out ${
        large ? 'min-h-36 py-4 text-4xl font-semibold tracking-tight' : 'min-h-28 py-3 text-2xl'
      } ${highlight ? 'lit scale-[1.02] border-transparent' : `${urgent ? 'border-accent/50' : 'border-line'} bg-surface shadow-[var(--glass-edge)]`}`}
    >
      {label}
      {highlight && progress > 0 && (
        <svg className="pointer-events-none absolute -inset-2 size-[calc(100%+16px)]" aria-hidden>
          <rect
            x="4"
            y="4"
            style={{ width: 'calc(100% - 8px)', height: 'calc(100% - 8px)' }}
            rx="18"
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="8"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - progress}
          />
        </svg>
      )}
    </div>
  )
}
