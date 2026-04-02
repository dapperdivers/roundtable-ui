import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { buildKnightConfigFromFleet, getKnightPosition, knightNameForDomain } from '../lib/knights'
import { MessageParticle } from './MessageParticle'
import type { NatsEvent } from '../hooks/useWebSocket'
import type { Knight } from '../hooks/useFleet'

const SVG_SIZE = 500
const CX = SVG_SIZE / 2
const CY = SVG_SIZE / 2
const RADIUS = 190
const NODE_R = 28

// Default color map for SVG fill (not tailwind) - fallback for static knights
const DEFAULT_KNIGHT_COLORS: Record<string, string> = {
  galahad: '#f87171', kay: '#60a5fa', tristan: '#22d3ee', gawain: '#facc15',
  agravain: '#fb923c', bedivere: '#4ade80', percival: '#a78bfa', patsy: '#fbbf24',
  gareth: '#34d399', lancelot: '#818cf8',
}

// Convert tailwind color classes to hex
function tailwindColorToHex(colorClass: string): string {
  const colorMap: Record<string, string> = {
    'text-red-400': '#f87171',
    'text-blue-400': '#60a5fa',
    'text-cyan-400': '#22d3ee',
    'text-yellow-400': '#facc15',
    'text-orange-400': '#fb923c',
    'text-green-400': '#4ade80',
    'text-purple-400': '#a78bfa',
    'text-amber-400': '#fbbf24',
    'text-emerald-400': '#34d399',
    'text-indigo-400': '#818cf8',
    'text-sky-400': '#38bdf8',
    'text-teal-400': '#2dd4bf',
    'text-pink-400': '#f472b6',
    'text-violet-400': '#a78bfa',
    'text-lime-400': '#a3e635',
    'text-rose-400': '#fb7185',
    'text-gray-400': '#9ca3af',
  }
  return colorMap[colorClass] || '#9ca3af'
}

interface Particle {
  id: number
  fromX: number; fromY: number
  toX: number; toY: number
  color: string
}

function parseSourceAndDest(event: NatsEvent): { source: string | null; dest: string | null; isTask: boolean } {
  const parts = event.subject.split('.')
  const type = parts[1] // tasks or results
  const domain = parts[2] || ''
  const isTask = type === 'tasks'

  const data = typeof event.data === 'string' ? (() => { try { return JSON.parse(event.data as string) } catch { return {} } })() : (event.data || {}) as Record<string, unknown>

  if (isTask) {
    const dest = knightNameForDomain(domain)
    const from = (data.from as string) || ''
    const source = ['ui', 'dashboard', 'tim', 'cron'].includes(from) ? 'center' : (knightNameForDomain(from) || 'center')
    return { source, dest, isTask: true }
  } else {
    // result
    const sourceKnight = (data.knight as string) || knightNameForDomain(domain) || null
    const from = (data.from as string) || ''
    const dest = ['ui', 'dashboard', 'tim', 'cron'].includes(from) ? 'center' : (knightNameForDomain(from) || 'center')
    return { source: sourceKnight, dest, isTask: false }
  }
}

interface Props {
  knights: Knight[]
  events: NatsEvent[]
  connected: boolean
  knightStatuses?: Record<string, string> // name -> 'online'|'offline'
  onKnightClick?: (knightName: string) => void
}

export function RoundTableGraph({ knights, events, connected, knightStatuses = {}, onKnightClick }: Props) {
  // Build dynamic knight config and names
  const knightConfig = useMemo(() => buildKnightConfigFromFleet(knights), [knights])
  const knightNames = useMemo(() => knights.map(k => k.name), [knights])
  
  // Build dynamic color map from knight config
  const knightColors = useMemo(() => {
    const colors: Record<string, string> = { ...DEFAULT_KNIGHT_COLORS }
    for (const name of knightNames) {
      const cfg = knightConfig[name]
      if (cfg && !colors[name]) {
        colors[name] = tailwindColorToHex(cfg.color)
      }
    }
    return colors
  }, [knightNames, knightConfig])

  // Helper to get node position (depends on dynamic knight list)
  const getNodePos = useCallback((name: string): { x: number; y: number } => {
    if (name === 'center') return { x: CX, y: CY }
    const idx = knightNames.indexOf(name)
    if (idx === -1) return { x: CX, y: CY }
    return getKnightPosition(idx, knightNames.length, CX, CY, RADIUS)
  }, [knightNames])
  const [particles, setParticles] = useState<Particle[]>([])
  const [pulsingKnights, setPulsingKnights] = useState<Set<string>>(new Set())
  const idRef = useRef(0)
  const lastEventCountRef = useRef(0)

  // Spawn particles for new events
  useEffect(() => {
    if (events.length <= lastEventCountRef.current && lastEventCountRef.current > 0) {
      lastEventCountRef.current = events.length
      return
    }
    const newCount = events.length - lastEventCountRef.current
    lastEventCountRef.current = events.length

    const newEvents = events.slice(0, Math.min(newCount, 5)) // cap burst
    const newParticles: Particle[] = []

    for (const ev of newEvents) {
      const { source, dest, isTask } = parseSourceAndDest(ev)
      if (!source || !dest) continue
      const from = getNodePos(source)
      const to = getNodePos(dest)
      newParticles.push({
        id: ++idRef.current,
        fromX: from.x, fromY: from.y,
        toX: to.x, toY: to.y,
        color: isTask ? '#60a5fa' : '#4ade80',
      })

      // Pulse destination
      if (dest !== 'center') {
        setPulsingKnights(prev => new Set(prev).add(dest))
        setTimeout(() => setPulsingKnights(prev => {
          const next = new Set(prev)
          next.delete(dest)
          return next
        }), 800)
      }
    }

    if (newParticles.length > 0) {
      setParticles(prev => [...prev, ...newParticles])
    }
  }, [events])

  const removeParticle = useCallback((id: number) => {
    setParticles(prev => prev.filter(p => p.id !== id))
  }, [])

  const totalMessages = events.length

  // Empty state
  if (knights.length === 0) {
    return (
      <div className="w-full max-w-[600px] mx-auto h-[500px] flex items-center justify-center bg-roundtable-navy rounded-xl border border-roundtable-steel">
        <div className="text-center">
          <p className="text-gray-500 mb-2">No knights in fleet</p>
          <p className="text-xs text-gray-600">Waiting for knight data...</p>
        </div>
      </div>
    )
  }

  return (
    <svg viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`} className="w-full max-w-[600px] mx-auto">
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="pulse-glow">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <radialGradient id="table-bg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0f172a" />
        </radialGradient>
      </defs>

      {/* Table circle */}
      <circle cx={CX} cy={CY} r={RADIUS + 40} fill="url(#table-bg)" stroke="#334155" strokeWidth={1.5} />
      <circle cx={CX} cy={CY} r={RADIUS} fill="none" stroke="#334155" strokeWidth={1} strokeDasharray="4 4" />

      {/* Center hub */}
      <circle cx={CX} cy={CY} r={24} fill="#1e293b" stroke={connected ? '#4ade80' : '#ef4444'} strokeWidth={2} />
      <text x={CX} y={CY - 4} textAnchor="middle" fontSize={16} fill="white">🔥</text>
      <text x={CX} y={CY + 14} textAnchor="middle" fontSize={8} fill="#94a3b8">Tim</text>
      {/* Stats below center */}
      <text x={CX} y={CY + 34} textAnchor="middle" fontSize={9} fill="#64748b">{totalMessages} msgs</text>

      {/* Knight nodes */}
      {knightNames.map((name, i) => {
        const pos = getKnightPosition(i, knightNames.length, CX, CY, RADIUS)
        const cfg = knightConfig[name]
        const col = knightColors[name] || '#94a3b8'
        const isPulsing = pulsingKnights.has(name)
        const isOnline = knightStatuses[name] === 'online'

        return (
          <g key={name} onClick={() => onKnightClick?.(name)} style={{ cursor: onKnightClick ? 'pointer' : 'default' }} className="knight-node">
            {/* Pulse ring */}
            {isPulsing && (
              <circle cx={pos.x} cy={pos.y} r={NODE_R + 8} fill="none" stroke={col} strokeWidth={2} opacity={0.6} filter="url(#pulse-glow)">
                <animate attributeName="r" from={String(NODE_R + 4)} to={String(NODE_R + 16)} dur="0.8s" fill="freeze" />
                <animate attributeName="opacity" from="0.6" to="0" dur="0.8s" fill="freeze" />
              </circle>
            )}
            {/* Hover hit area */}
            <circle cx={pos.x} cy={pos.y} r={NODE_R + 6} fill="transparent" />
            {/* Node circle */}
            <circle cx={pos.x} cy={pos.y} r={NODE_R} fill="#1e293b" stroke={col} strokeWidth={2} className="transition-all duration-150 hover:brightness-125" />
            {/* Emoji */}
            <text x={pos.x} y={pos.y + 2} textAnchor="middle" fontSize={18} dominantBaseline="central">{cfg?.emoji || '🤖'}</text>
            {/* Name */}
            <text x={pos.x} y={pos.y + NODE_R + 14} textAnchor="middle" fontSize={10} fill="#cbd5e1" className="capitalize">{name}</text>
            {/* Status dot */}
            <circle cx={pos.x + NODE_R - 4} cy={pos.y - NODE_R + 4} r={4} fill={isOnline ? '#4ade80' : '#475569'} stroke="#0f172a" strokeWidth={1.5} />
          </g>
        )
      })}

      {/* Animated particles */}
      {particles.map(p => (
        <MessageParticle
          key={p.id}
          fromX={p.fromX} fromY={p.fromY}
          toX={p.toX} toY={p.toY}
          color={p.color}
          onDone={() => removeParticle(p.id)}
        />
      ))}
    </svg>
  )
}
