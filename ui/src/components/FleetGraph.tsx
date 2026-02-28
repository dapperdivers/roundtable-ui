import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  ReactFlow,
  type Node,
  type Edge,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type NodeTypes,
  Handle,
  Position,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { KNIGHT_CONFIG, KNIGHT_NAMES, getKnightConfig, knightNameForDomain } from '../lib/knights'
import type { NatsEvent } from '../hooks/useWebSocket'

// --- Heat color mapping ---
function heatColor(level: number): string {
  // 0 = cool (idle), 1 = hot (very busy)
  if (level <= 0) return '#334155' // steel gray
  if (level < 0.2) return '#22c55e' // green
  if (level < 0.5) return '#eab308' // yellow
  if (level < 0.8) return '#f97316' // orange
  return '#ef4444' // red
}

function heatGlow(level: number): string {
  if (level <= 0) return 'none'
  const color = heatColor(level)
  return `0 0 ${8 + level * 16}px ${color}40, 0 0 ${4 + level * 8}px ${color}60`
}

// --- Custom Knight Node ---
interface KnightNodeData {
  label: string
  emoji: string
  domain: string
  color: string
  heat: number
  status: string
  busy: boolean
  recentTasks: number
  [key: string]: unknown
}

function KnightNode({ data }: NodeProps<Node<KnightNodeData>>) {
  const heat = data.heat ?? 0
  const borderColor = data.status === 'online' ? heatColor(heat) : '#475569'

  return (
    <div
      className="relative flex flex-col items-center"
      style={{ filter: data.status === 'offline' ? 'grayscale(0.6) opacity(0.5)' : 'none' }}
    >
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0 !w-0 !h-0" />
      <div
        className="flex items-center justify-center rounded-full transition-all duration-300"
        style={{
          width: 56,
          height: 56,
          border: `2.5px solid ${borderColor}`,
          background: '#1e293b',
          boxShadow: heatGlow(heat),
        }}
      >
        <span className="text-2xl">{data.emoji}</span>
        {data.busy && (
          <span
            className="absolute top-0 right-0 w-3 h-3 rounded-full bg-amber-400 border border-roundtable-navy"
            style={{ animation: 'pulse 1.5s ease-in-out infinite' }}
          />
        )}
      </div>
      <span className="text-xs text-gray-300 mt-1 capitalize font-medium">{data.label}</span>
      {data.recentTasks > 0 && (
        <span className="text-[10px] text-gray-500">{data.recentTasks} tasks</span>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0 !w-0 !h-0" />
    </div>
  )
}

// --- Custom Hub Node (Tim) ---
interface HubNodeData {
  connected: boolean
  totalMessages: number
  [key: string]: unknown
}

function HubNode({ data }: NodeProps<Node<HubNodeData>>) {
  return (
    <div className="flex flex-col items-center">
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0 !w-0 !h-0" />
      <div
        className="flex items-center justify-center rounded-full"
        style={{
          width: 64,
          height: 64,
          border: `2.5px solid ${data.connected ? '#4ade80' : '#ef4444'}`,
          background: '#1e293b',
          boxShadow: data.connected ? '0 0 12px #4ade8040' : '0 0 12px #ef444440',
        }}
      >
        <span className="text-3xl">🔥</span>
      </div>
      <span className="text-xs text-gray-300 mt-1 font-bold">Tim</span>
      <span className="text-[10px] text-gray-500">{data.totalMessages} msgs</span>
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0 !w-0 !h-0" />
    </div>
  )
}

const nodeTypes: NodeTypes = {
  knight: KnightNode,
  hub: HubNode,
}

// --- Layout: force-directed-ish radial with activity clustering ---
function layoutNodes(
  knightNames: string[],
  activity: Record<string, { heat: number; recentTasks: number; busy: boolean; status: string }>,
): Node[] {
  const cx = 400
  const cy = 300
  const radius = 240

  // Hub
  const nodes: Node[] = [
    {
      id: 'tim',
      type: 'hub',
      position: { x: cx - 32, y: cy - 32 },
      data: { connected: true, totalMessages: 0 },
      draggable: true,
    },
  ]

  // Place knights radially, but pull busy ones slightly closer
  knightNames.forEach((name, i) => {
    const cfg = getKnightConfig(name)
    const act = activity[name] || { heat: 0, recentTasks: 0, busy: false, status: 'offline' }
    const angle = (2 * Math.PI * i) / knightNames.length - Math.PI / 2
    const r = act.busy ? radius * 0.8 : radius // busy knights pulled closer

    nodes.push({
      id: name,
      type: 'knight',
      position: {
        x: cx + r * Math.cos(angle) - 28,
        y: cy + r * Math.sin(angle) - 28,
      },
      data: {
        label: name,
        emoji: cfg.emoji,
        domain: cfg.domain,
        color: cfg.color,
        heat: act.heat,
        status: act.status,
        busy: act.busy,
        recentTasks: act.recentTasks,
      },
      draggable: true,
    })
  })

  return nodes
}

function buildEdges(
  knightNames: string[],
  recentEvents: NatsEvent[],
): Edge[] {
  const edges: Edge[] = []
  const edgeActivity: Record<string, number> = {}

  // Base edges from Tim to each knight (faint)
  knightNames.forEach((name) => {
    edges.push({
      id: `tim-${name}`,
      source: 'tim',
      target: name,
      style: { stroke: '#334155', strokeWidth: 1 },
      animated: false,
    })
  })

  // Count recent messages per edge pair
  for (const event of recentEvents.slice(0, 50)) {
    const parts = event.subject.split('.')
    const domain = parts[2] || ''
    const isTask = parts[1] === 'tasks'
    const knight = knightNameForDomain(domain)
    if (!knight) continue

    const data = (typeof event.data === 'string'
      ? (() => { try { return JSON.parse(event.data as string) } catch { return {} } })()
      : event.data || {}) as Record<string, unknown>

    const from = (data.from as string) || ''
    const sourceKnight = knightNameForDomain(from)

    let edgeKey: string
    if (isTask) {
      edgeKey = sourceKnight ? `${sourceKnight}-${knight}` : `tim-${knight}`
    } else {
      edgeKey = sourceKnight ? `${knight}-${sourceKnight}` : `${knight}-tim`
    }

    edgeActivity[edgeKey] = (edgeActivity[edgeKey] || 0) + 1
  }

  // Add knight-to-knight edges for cross-communication
  for (const [key, count] of Object.entries(edgeActivity)) {
    const [src, tgt] = key.split('-')
    if (!src || !tgt) continue

    const existingIdx = edges.findIndex((e) => e.id === key || e.id === `${tgt}-${src}`)
    const intensity = Math.min(count / 5, 1)
    const strokeWidth = 1 + intensity * 3

    if (existingIdx >= 0) {
      // Upgrade existing edge
      edges[existingIdx] = {
        ...edges[existingIdx],
        style: {
          stroke: heatColor(intensity),
          strokeWidth,
        },
        animated: count > 0,
      }
    } else {
      // New knight-to-knight edge
      edges.push({
        id: key,
        source: src,
        target: tgt,
        style: {
          stroke: heatColor(intensity),
          strokeWidth,
        },
        animated: count > 0,
      })
    }
  }

  return edges
}

// --- Main Component ---
interface FleetGraphProps {
  events: NatsEvent[]
  connected: boolean
  knightStatuses?: Record<string, string>
  onKnightClick?: (knightName: string) => void
}

export function FleetGraph({ events, connected, knightStatuses = {}, onKnightClick }: FleetGraphProps) {
  const lastLayoutRef = useRef<string>('')

  // Compute activity from events
  const activity = useMemo(() => {
    const act: Record<string, { heat: number; recentTasks: number; busy: boolean; status: string; pendingTasks: Set<string> }> = {}

    for (const name of KNIGHT_NAMES) {
      act[name] = {
        heat: 0,
        recentTasks: 0,
        busy: false,
        status: knightStatuses[name] || 'offline',
        pendingTasks: new Set(),
      }
    }

    // Process events to compute activity
    for (const event of events) {
      const parts = event.subject.split('.')
      const domain = parts[2] || ''
      const knight = knightNameForDomain(domain)
      if (!knight || !act[knight]) continue

      if (event.type === 'task') {
        act[knight].recentTasks++
        const data = (typeof event.data === 'string'
          ? (() => { try { return JSON.parse(event.data as string) } catch { return {} } })()
          : event.data || {}) as Record<string, unknown>
        const taskId = (data.task_id as string) || ''
        if (taskId) act[knight].pendingTasks.add(taskId)
      } else {
        const data = (typeof event.data === 'string'
          ? (() => { try { return JSON.parse(event.data as string) } catch { return {} } })()
          : event.data || {}) as Record<string, unknown>
        const taskId = (data.task_id as string) || ''
        if (taskId) act[knight].pendingTasks.delete(taskId)
      }
    }

    // Compute heat levels
    for (const name of KNIGHT_NAMES) {
      const a = act[name]
      a.busy = a.pendingTasks.size > 0
      a.heat = Math.min(a.recentTasks / 10, 1) // normalize to 0-1
      if (a.busy) a.heat = Math.max(a.heat, 0.5) // busy = at least warm
    }

    return act
  }, [events, knightStatuses])

  // Build initial nodes
  const initialNodes = useMemo(() => {
    const nodes = layoutNodes(KNIGHT_NAMES, activity)
    // Update hub data
    const hub = nodes.find((n) => n.id === 'tim')
    if (hub) {
      hub.data = { connected, totalMessages: events.length }
    }
    return nodes
  }, []) // Only compute layout once

  const initialEdges = useMemo(() => buildEdges(KNIGHT_NAMES, events), [])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // Update node data (heat, status) without changing positions
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === 'tim') {
          return { ...node, data: { ...node.data, connected, totalMessages: events.length } }
        }
        const act = activity[node.id]
        if (act) {
          return {
            ...node,
            data: {
              ...node.data,
              heat: act.heat,
              status: act.status,
              busy: act.busy,
              recentTasks: act.recentTasks,
            },
          }
        }
        return node
      }),
    )
  }, [activity, connected, events.length, setNodes])

  // Update edges — debounced to avoid layout thrash (#44)
  const edgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (edgeTimerRef.current) clearTimeout(edgeTimerRef.current)
    edgeTimerRef.current = setTimeout(() => {
      const newEdges = buildEdges(KNIGHT_NAMES, events)
      setEdges(newEdges)
    }, 300)
    return () => { if (edgeTimerRef.current) clearTimeout(edgeTimerRef.current) }
  }, [events, setEdges])

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.id !== 'tim' && onKnightClick) {
        onKnightClick(node.id)
      }
    },
    [onKnightClick],
  )

  return (
    <div className="w-full h-[500px] bg-roundtable-navy rounded-xl border border-roundtable-steel overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.5}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        className="fleet-graph"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1e293b" />
      </ReactFlow>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 flex items-center gap-3 text-[10px] text-gray-500 bg-roundtable-navy/80 backdrop-blur px-3 py-1.5 rounded-lg border border-roundtable-steel/50">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#334155]" /> Idle
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#22c55e]" /> Low
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#eab308]" /> Medium
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#f97316]" /> High
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#ef4444]" /> Hot
        </span>
      </div>
    </div>
  )
}
