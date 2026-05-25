import * as React from 'react'

const PETAL_ROTATIONS = [0, 72, 144, 216, 288] as const

type SakuraMarkProps = {
  size?: number
  color?: string
  className?: string
  style?: React.CSSProperties
}

/** Decorative five-petal sakura motif for hero / profile surfaces. Keep low-contrast. */
function SakuraMark({
  size = 120,
  color = 'rgba(255,255,255,0.08)',
  className,
  style,
}: SakuraMarkProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      style={style}
      aria-hidden
    >
      {PETAL_ROTATIONS.map((rot) => (
        <ellipse
          key={rot}
          cx="50"
          cy="28"
          rx="11"
          ry="20"
          fill={color}
          transform={`rotate(${rot} 50 50)`}
        />
      ))}
      <circle cx="50" cy="50" r="5" fill={color} />
    </svg>
  )
}

export { SakuraMark }
