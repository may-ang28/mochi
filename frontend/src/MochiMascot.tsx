import type { AnimationEventHandler } from 'react'

type MochiMascotProps = {
  className?: string
  expression?: 'happy' | 'curious' | 'sleepy'
  onAnimationEnd?: AnimationEventHandler<HTMLSpanElement>
}

function MochiMascot({ className = '', expression = 'happy', onAnimationEnd }: MochiMascotProps) {
  return (
    <span className={`mochi-orb mochi-orb-${expression}${className ? ` ${className}` : ''}`} aria-hidden="true" onAnimationEnd={onAnimationEnd}>
      <i className="mochi-orb-eye mochi-orb-eye-left" />
      <i className="mochi-orb-eye mochi-orb-eye-right" />
      <i className="mochi-orb-mouth" />
      <i className="mochi-orb-blush" />
    </span>
  )
}

export default MochiMascot
