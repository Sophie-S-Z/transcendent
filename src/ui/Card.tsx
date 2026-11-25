/**
 * One scan item. The highlighted card has an accent border. During a held blink a ring closes around it.
 */
export function Card({
  label,
  highlight,
  progress,
  large = false,
}: {
  label: string
  highlight: boolean
  progress: number
  large?: boolean
}) {
  return (
    <div
      data-highlight={highlight || undefined}
      className={`relative flex items-center rounded-2xl bg-surface px-6 transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
        large ? 'min-h-36 py-4 text-4xl font-bold' : 'h-full min-h-24 py-2 text-xl'
      } ${highlight ? 'scale-[1.03] outline-4 outline-accent' : 'outline-2 outline-surface'}`}
    >
      {label}
      {highlight && progress > 0 && (
        <svg className="pointer-events-none absolute -inset-2 size-[calc(100%+16px)]" aria-hidden>
          <rect
            x="4"
            y="4"
            style={{ width: 'calc(100% - 8px)', height: 'calc(100% - 8px)' }}
            rx="20"
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
