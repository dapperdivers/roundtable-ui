import { useState, useEffect, useCallback, useMemo } from 'react'
import { RefreshCw, ChevronDown, ChevronRight, Clock } from 'lucide-react'
import { getKnightConfig } from '../lib/knights'

interface ChainStep {
  name: string
  knight: string
  domain: string
  phase: string
  startTime: string | null
  completionTime: string | null
  result: string | null
  dependsOn: string[]
  retryCount: number
}

interface ChainRun {
  name: string
  namespace: string
  phase: string
  currentStep: string
  startTime: string | null
  completionTime: string | null
  steps: ChainStep[]
  schedule?: string
}

const phaseColors: Record<string, string> = {
  Pending: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  Running: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  StepRunning: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Completed: 'bg-green-500/20 text-green-400 border-green-500/30',
  Failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  Skipped: 'bg-gray-500/20 text-gray-500 border-gray-500/30',
}

function PhaseBadge({ phase }: { phase: string }) {
  const cls = phaseColors[phase] || phaseColors.Pending
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${cls}`}>
      {phase}
    </span>
  )
}

function formatDuration(start: string | null, end: string | null): string {
  if (!start) return '—'
  const s = new Date(start).getTime()
  const e = end ? new Date(end).getTime() : Date.now()
  const sec = Math.round((e - s) / 1000)
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`
}

/** Assign each step a column (x) based on topological order of dependencies */
function layoutSteps(steps: ChainStep[]): Map<string, { col: number; row: number }> {
  const stepMap = new Map(steps.map(s => [s.name, s]))
  const columns = new Map<string, number>()

  // Compute column: max(dependsOn columns) + 1, or 0 if no deps
  function getCol(name: string): number {
    if (columns.has(name)) return columns.get(name)!
    const step = stepMap.get(name)
    if (!step || step.dependsOn.length === 0) { columns.set(name, 0); return 0 }
    const maxParent = Math.max(...step.dependsOn.map(d => getCol(d)))
    const col = maxParent + 1
    columns.set(name, col)
    return col
  }

  steps.forEach(s => getCol(s.name))

  // Group by column, assign rows within each column
  const colGroups = new Map<number, string[]>()
  for (const [name, col] of columns) {
    if (!colGroups.has(col)) colGroups.set(col, [])
    colGroups.get(col)!.push(name)
  }

  const positions = new Map<string, { col: number; row: number }>()
  for (const [col, names] of colGroups) {
    names.forEach((name, row) => positions.set(name, { col, row }))
  }
  return positions
}

function StepDAG({ steps, currentStep }: { steps: ChainStep[]; currentStep: string }) {
  const positions = useMemo(() => layoutSteps(steps), [steps])
  const maxCol = Math.max(0, ...Array.from(positions.values()).map(p => p.col))
  const maxRow = Math.max(0, ...Array.from(positions.values()).map(p => p.row))

  const nodeW = 180
  const nodeH = 64
  const gapX = 60
  const gapY = 20
  const padX = 20
  const padY = 20

  const svgW = padX * 2 + (maxCol + 1) * nodeW + maxCol * gapX
  const svgH = padY * 2 + (maxRow + 1) * nodeH + maxRow * gapY

  const pos = (col: number, row: number) => ({
    x: padX + col * (nodeW + gapX),
    y: padY + row * (nodeH + gapY),
  })

  const stepMap = new Map(steps.map(s => [s.name, s]))

  return (
    <div className="overflow-x-auto mt-3">
      <svg width={svgW} height={svgH} className="min-w-full">
        {/* Edges */}
        {steps.map(step => {
          const target = positions.get(step.name)
          if (!target) return null
          return step.dependsOn.map(dep => {
            const source = positions.get(dep)
            if (!source) return null
            const s = pos(source.col, source.row)
            const t = pos(target.col, target.row)
            return (
              <line
                key={`${dep}->${step.name}`}
                x1={s.x + nodeW} y1={s.y + nodeH / 2}
                x2={t.x} y2={t.y + nodeH / 2}
                stroke="#4b5563" strokeWidth={2} markerEnd=""
              />
            )
          })
        })}
        {/* Nodes */}
        {steps.map(step => {
          const p = positions.get(step.name)
          if (!p) return null
          const { x, y } = pos(p.col, p.row)
          const cfg = getKnightConfig(step.knight)
          const isRunning = step.phase === 'Running' || step.name === currentStep
          const isSkipped = step.phase === 'Skipped'
          const borderColor = step.phase === 'Completed' ? '#22c55e'
            : step.phase === 'Failed' ? '#ef4444'
            : isRunning ? '#3b82f6'
            : '#4b5563'

          return (
            <g key={step.name}>
              {isRunning && (
                <rect x={x - 2} y={y - 2} width={nodeW + 4} height={nodeH + 4} rx={10}
                  fill="none" stroke="#3b82f6" strokeWidth={2} opacity={0.6}>
                  <animate attributeName="opacity" values="0.3;0.8;0.3" dur="1.5s" repeatCount="indefinite" />
                </rect>
              )}
              <rect x={x} y={y} width={nodeW} height={nodeH} rx={8}
                fill="#1e293b" stroke={borderColor} strokeWidth={1.5} />
              <text x={x + 10} y={y + 22} fill={isSkipped ? '#6b7280' : '#e5e7eb'}
                fontSize={12} fontWeight={600}
                textDecoration={isSkipped ? 'line-through' : 'none'}>
                {cfg.emoji} {step.name}
              </text>
              <text x={x + 10} y={y + 40} fill="#9ca3af" fontSize={10}>
                {cfg.title} · {formatDuration(step.startTime, step.completionTime)}
              </text>
              <text x={x + 10} y={y + 54} fill={borderColor} fontSize={10}>
                {step.phase}{step.retryCount > 0 ? ` (retry ${step.retryCount})` : ''}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function ChainCard({ chain }: { chain: ChainRun }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-roundtable-slate border border-roundtable-steel rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-roundtable-steel/30 transition-colors"
      >
        {expanded
          ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
          : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
        <span className="font-semibold text-white">{chain.name}</span>
        <PhaseBadge phase={chain.phase} />
        {chain.schedule && (
          <span className="text-xs text-gray-500 font-mono">{chain.schedule}</span>
        )}
        <span className="text-xs text-gray-500">{chain.steps.length} steps</span>
        <span className="ml-auto flex items-center gap-1 text-xs text-gray-500">
          <Clock className="w-3 h-3" />
          {formatDuration(chain.startTime, chain.completionTime)}
        </span>
      </button>
      {expanded && (
        <div className="px-5 pb-4 border-t border-roundtable-steel/50">
          <StepDAG steps={chain.steps} currentStep={chain.currentStep} />
        </div>
      )}
    </div>
  )
}

export function ChainsPage() {
  const [chains, setChains] = useState<ChainRun[]>([])
  const [loading, setLoading] = useState(true)

  const fetchChains = useCallback(() => {
    setLoading(true)
    fetch('/api/chains')
      .then(r => r.json())
      .then((data: ChainRun[]) => setChains(data))
      .catch(() => setChains([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchChains() }, [fetchChains])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-white">⛓️ Chain Executions</h1>
        <button onClick={fetchChains}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-roundtable-steel/50 hover:bg-roundtable-steel text-gray-300 rounded-lg transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {chains.length === 0 && !loading && (
        <p className="text-gray-500 text-center py-12">No chain executions found.</p>
      )}

      <div className="space-y-3">
        {chains.map(chain => <ChainCard key={`${chain.namespace}/${chain.name}`} chain={chain} />)}
      </div>
    </div>
  )
}
