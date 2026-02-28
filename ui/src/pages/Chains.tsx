import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { RefreshCw, ChevronDown, ChevronRight, Clock, Pause, Play } from 'lucide-react'
import { getKnightConfig } from '../lib/knights'

interface ChainStep {
  name: string
  knight: string
  domain: string
  phase: string
  startTime: string | null
  completionTime: string | null
  result: string | null
  dependsOn: string[] | null
  retryCount: number
}

interface ChainRun {
  name: string
  namespace: string
  phase: string
  currentStep: string
  startTime: string | null
  completionTime: string | null
  steps: ChainStep[] | null
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
    if (!step || !step.dependsOn || step.dependsOn.length === 0) { columns.set(name, 0); return 0 }
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
          return (step.dependsOn || []).map(dep => {
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

function StepDetail({ step }: { step: ChainStep }) {
  const cfg = getKnightConfig(step.knight)
  return (
    <div className="bg-roundtable-navy border border-roundtable-steel rounded-lg p-4 mt-2">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{cfg.emoji}</span>
        <span className="font-semibold text-white capitalize">{step.name}</span>
        <PhaseBadge phase={step.phase} />
        <span className="text-xs text-gray-500 ml-auto">{formatDuration(step.startTime, step.completionTime)}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm mb-3">
        <div><span className="text-gray-500">Knight:</span> <span className="text-gray-300">{step.knight}</span></div>
        <div><span className="text-gray-500">Domain:</span> <span className="text-gray-300">{step.domain}</span></div>
        {step.dependsOn && step.dependsOn.length > 0 && (
          <div className="col-span-2"><span className="text-gray-500">Depends on:</span> <span className="text-gray-300">{step.dependsOn.join(', ')}</span></div>
        )}
        {step.retryCount > 0 && (
          <div><span className="text-gray-500">Retries:</span> <span className="text-yellow-400">{step.retryCount}</span></div>
        )}
      </div>
      {step.result && (
        <div>
          <span className="text-xs text-gray-500 uppercase">Result</span>
          <pre className="text-xs text-gray-400 whitespace-pre-wrap max-h-64 overflow-auto mt-1 bg-roundtable-slate rounded p-3 border border-roundtable-steel/50">
            {step.result}
          </pre>
        </div>
      )}
    </div>
  )
}

function ChainCard({ chain }: { chain: ChainRun }) {
  const [expanded, setExpanded] = useState(false)
  const [selectedStep, setSelectedStep] = useState<string | null>(null)

  const activeStep = selectedStep
    ? (chain.steps || []).find(s => s.name === selectedStep) || null
    : null

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
        <span className="text-xs text-gray-500">{(chain.steps || []).length} steps</span>
        <span className="ml-auto flex items-center gap-1 text-xs text-gray-500">
          <Clock className="w-3 h-3" />
          {formatDuration(chain.startTime, chain.completionTime)}
        </span>
      </button>
      {expanded && (
        <div className="px-5 pb-4 border-t border-roundtable-steel/50">
          <StepDAG steps={chain.steps || []} currentStep={chain.currentStep} />
          {/* Step list for drill-down (#49) */}
          <div className="mt-3 flex flex-wrap gap-2">
            {(chain.steps || []).map(step => {
              const cfg = getKnightConfig(step.knight)
              return (
                <button key={step.name}
                  onClick={() => setSelectedStep(selectedStep === step.name ? null : step.name)}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                    selectedStep === step.name
                      ? 'bg-roundtable-gold/20 border-roundtable-gold/30 text-roundtable-gold'
                      : 'border-roundtable-steel text-gray-400 hover:text-white hover:border-gray-500'
                  }`}>
                  {cfg.emoji} {step.name}
                </button>
              )
            })}
          </div>
          {activeStep && <StepDetail step={activeStep} />}
        </div>
      )}
    </div>
  )
}

export function ChainsPage() {
  const [chains, setChains] = useState<ChainRun[]>([])
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const autoRefreshInitialized = useRef(false)

  const abortRef = useRef<AbortController | null>(null)

  const fetchChains = useCallback(() => {
    // Abort any in-flight request (#39)
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    fetch('/api/chains', { signal: controller.signal })
      .then(r => r.json())
      .then((data: ChainRun[]) => { if (!controller.signal.aborted) setChains(data) })
      .catch((e) => { if (e.name !== 'AbortError') setChains([]) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
  }, [])

  useEffect(() => { fetchChains() }, [fetchChains])

  // Auto-enable when any chain is Running, auto-disable when all done
  useEffect(() => {
    if (chains.length === 0) return
    const hasRunning = chains.some(c => c.phase === 'Running' || c.phase === 'StepRunning')
    if (!autoRefreshInitialized.current) {
      setAutoRefresh(hasRunning)
      autoRefreshInitialized.current = true
    } else if (!hasRunning && autoRefresh) {
      setAutoRefresh(false)
    }
  }, [chains, autoRefresh])

  // Poll interval — debounced (#38), pause when hidden (#22)
  useEffect(() => {
    if (!autoRefresh) return
    let interval: ReturnType<typeof setInterval> | null = null

    const start = () => { if (!interval) interval = setInterval(fetchChains, 8000) }
    const stop = () => { if (interval) { clearInterval(interval); interval = null } }
    const onVis = () => { document.hidden ? stop() : start() }

    start()
    document.addEventListener('visibilitychange', onVis)
    return () => { stop(); document.removeEventListener('visibilitychange', onVis) }
  }, [autoRefresh, fetchChains])

  // Cleanup abort on unmount
  useEffect(() => () => { abortRef.current?.abort() }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-white">⛓️ Chain Executions</h1>
        <div className="flex items-center gap-3">
          {autoRefresh && (
            <span className="flex items-center gap-1.5 text-xs text-blue-400">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Auto-refreshing every 5s
            </span>
          )}
          <button
            onClick={() => setAutoRefresh(a => !a)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
              autoRefresh
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'bg-roundtable-steel/50 text-gray-400 hover:text-gray-300'
            }`}
          >
            {autoRefresh ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            Auto
          </button>
          <button onClick={fetchChains}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-roundtable-steel/50 hover:bg-roundtable-steel text-gray-300 rounded-lg transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
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
