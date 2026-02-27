import { useEffect, useRef } from 'react'

interface Props {
  fromX: number
  fromY: number
  toX: number
  toY: number
  color: string // hex color
  duration?: number // ms
  onDone: () => void
}

/** Compute a quadratic bezier control point offset perpendicular to the line */
function controlPoint(x1: number, y1: number, x2: number, y2: number) {
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy)
  const offset = Math.min(len * 0.3, 60)
  // perpendicular
  return { cx: mx - (dy / len) * offset, cy: my + (dx / len) * offset }
}

export function MessageParticle({ fromX, fromY, toX, toY, color, duration = 1200, onDone }: Props) {
  const circleRef = useRef<SVGCircleElement>(null)
  const trailRef = useRef<SVGCircleElement>(null)

  useEffect(() => {
    const el = circleRef.current
    const trail = trailRef.current
    if (!el || !trail) return

    const { cx, cy } = controlPoint(fromX, fromY, toX, toY)
    const start = performance.now()

    let raf: number
    const animate = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      // Quadratic bezier
      const u = 1 - t
      const x = u * u * fromX + 2 * u * t * cx + t * t * toX
      const y = u * u * fromY + 2 * u * t * cy + t * t * toY
      el.setAttribute('cx', String(x))
      el.setAttribute('cy', String(y))
      el.setAttribute('opacity', String(t < 0.8 ? 1 : 1 - (t - 0.8) / 0.2))

      // trail slightly behind
      const tt = Math.max(t - 0.08, 0)
      const ut = 1 - tt
      trail.setAttribute('cx', String(ut * ut * fromX + 2 * ut * tt * cx + tt * tt * toX))
      trail.setAttribute('cy', String(ut * ut * fromY + 2 * ut * tt * cy + tt * tt * toY))
      trail.setAttribute('opacity', String((t < 0.7 ? 0.5 : 0) * (t > 0.05 ? 1 : 0)))

      if (t < 1) {
        raf = requestAnimationFrame(animate)
      } else {
        onDone()
      }
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [fromX, fromY, toX, toY, color, duration, onDone])

  return (
    <g>
      <circle ref={trailRef} r={3} fill={color} opacity={0} />
      <circle ref={circleRef} r={5} fill={color} opacity={0}>
        {/* glow filter applied via parent SVG defs */}
      </circle>
    </g>
  )
}
