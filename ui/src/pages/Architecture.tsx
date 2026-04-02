import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Network, Server, Globe, MessageSquare, Shield, Crown, Cpu, RefreshCw, Target } from 'lucide-react'
import { authFetch } from '../lib/auth'
import { useFleet } from '../hooks/useFleet'

interface RoundTable {
  name: string
  natsPrefix: string
  activeMissions?: number
  knightsTotal: number
  knightsReady: number
}

interface ComponentNode {
  id: string
  label: string
  description: string
  icon: React.ReactNode
  color: string
  connections: string[]
  stats?: string
  link?: string
}

export function ArchitecturePage() {
  const navigate = useNavigate()
  const { knights, loading: knightsLoading } = useFleet()
  const [roundTables, setRoundTables] = useState<RoundTable[]>([])
  const [missions, setMissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [rtRes, missionsRes] = await Promise.all([
        authFetch('/api/roundtables'),
        authFetch('/api/missions')
      ])
      
      if (rtRes.ok) {
        const rtData = await rtRes.json()
        setRoundTables(rtData)
      }
      
      if (missionsRes.ok) {
        const missionsData = await missionsRes.json()
        setMissions(missionsData)
      }
      
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const knightCount = knights.length
  const onlineKnights = knights.filter(k => k.status === 'online').length
  const roundTableCount = roundTables.length
  const activeMissionsCount = missions.filter(m => m.phase !== 'Succeeded' && m.phase !== 'Failed' && m.phase !== 'Expired').length
  const totalMissionsCount = missions.length
  const natsStreams = [...new Set(roundTables.map(rt => rt.natsPrefix).filter(Boolean))].join(', ') || 'fleet-*'

  const COMPONENTS: ComponentNode[] = [
    { 
      id: 'ui', 
      label: 'Dashboard UI', 
      description: 'React SPA — observability & control plane', 
      icon: <Globe className="w-6 h-6" />, 
      color: 'text-blue-400 border-blue-500/30 bg-blue-500/10', 
      connections: ['api'],
      stats: 'You are here',
      link: '/'
    },
    { 
      id: 'api', 
      label: 'Dashboard API', 
      description: 'Go API — proxies K8s & NATS to the UI', 
      icon: <Server className="w-6 h-6" />, 
      color: 'text-green-400 border-green-500/30 bg-green-500/10', 
      connections: ['nats', 'k8s'],
      stats: 'Running'
    },
    { 
      id: 'k8s', 
      label: 'Kubernetes API', 
      description: 'Cluster state — pods, CRDs (Missions, Chains, RoundTables)', 
      icon: <Cpu className="w-6 h-6" />, 
      color: 'text-purple-400 border-purple-500/30 bg-purple-500/10', 
      connections: ['knights', 'operator'],
      stats: `${roundTableCount} RoundTable${roundTableCount !== 1 ? 's' : ''}`,
      link: '/roundtables'
    },
    { 
      id: 'nats', 
      label: 'NATS / JetStream', 
      description: 'Message bus — tasks, results, mission events', 
      icon: <MessageSquare className="w-6 h-6" />, 
      color: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10', 
      connections: ['knights'],
      stats: `Streams: ${natsStreams}`
    },
    { 
      id: 'operator', 
      label: 'RoundTable Operator', 
      description: 'Manages Missions, Chains, and RoundTable CRDs', 
      icon: <Crown className="w-6 h-6" />, 
      color: 'text-roundtable-gold border-roundtable-gold/30 bg-roundtable-gold/10', 
      connections: ['k8s', 'nats'],
      stats: `${activeMissionsCount} active / ${totalMissionsCount} total missions`,
      link: '/missions'
    },
    { 
      id: 'knights', 
      label: `Knights (${knightCount} agents)`, 
      description: 'AI agents — execute tasks, report results', 
      icon: <Shield className="w-6 h-6" />, 
      color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10', 
      connections: ['nats'],
      stats: `${onlineKnights} online`,
      link: '/fleet'
    },
  ]
  const isLoading = loading || knightsLoading

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Network className="w-8 h-8 text-roundtable-gold" />
          <h1 className="text-3xl font-bold text-white">Architecture</h1>
        </div>
        <button
          onClick={fetchData}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-roundtable-steel/50 hover:bg-roundtable-steel text-gray-300 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
      <p className="text-gray-400 mb-8 max-w-2xl">
        The Round Table system consists of a Kubernetes operator managing AI agent fleets,
        connected via NATS messaging and observed through this dashboard.
      </p>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
          <p className="text-red-400 text-sm">Failed to load live data: {error}</p>
        </div>
      )}

      {isLoading && roundTables.length === 0 && (
        <div className="text-center py-12 mb-8">
          <div className="animate-spin w-8 h-8 border-2 border-roundtable-gold border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading architecture data...</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
        {COMPONENTS.map(comp => (
          <div 
            key={comp.id} 
            className={`rounded-xl border p-5 ${comp.color} transition-all hover:scale-[1.02] ${comp.link ? 'cursor-pointer' : ''}`}
            onClick={() => comp.link && navigate(comp.link)}
          >
            <div className="flex items-center gap-3 mb-3">
              {comp.icon}
              <h3 className="text-lg font-bold">{comp.label}</h3>
            </div>
            <p className="text-sm opacity-80 mb-3">{comp.description}</p>
            {comp.stats && (
              <div className="mb-3">
                <span className="text-xs px-2 py-1 rounded bg-white/10 border border-white/20 font-mono">
                  {comp.stats}
                </span>
              </div>
            )}
            {comp.connections.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {comp.connections.map(c => {
                  const target = COMPONENTS.find(x => x.id === c)
                  return <span key={c} className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10">→ {target?.label.split('(')[0].trim() || c}</span>
                })}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="bg-roundtable-slate border border-roundtable-steel rounded-xl p-6">
        <h2 className="text-lg font-bold text-white mb-4">Data Flow</h2>
        <div className="space-y-3 text-sm text-gray-300">
          {[
            ['Missions', 'are created as Kubernetes CRDs, dispatched by the operator'],
            ['Chains', 'define multi-step workflows with dependencies between knights'],
            ['Tasks', 'are published to NATS subjects, routed to the right knight by domain'],
            ['Results', 'flow back through NATS and are persisted in JetStream'],
            ['This Dashboard', 'observes everything via the Go API (K8s + NATS proxy)'],
          ].map(([title, desc], i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="text-roundtable-gold font-mono text-xs mt-0.5">{i + 1}.</span>
              <p><strong className="text-white">{title}</strong> {desc}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-6 bg-roundtable-slate border border-roundtable-steel rounded-xl p-6">
        <h2 className="text-lg font-bold text-white mb-4">Tech Stack</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><h4 className="text-gray-400 mb-1">Frontend</h4><p className="text-white">React 18 + TypeScript</p><p className="text-gray-500">Vite, Tailwind CSS</p></div>
          <div><h4 className="text-gray-400 mb-1">API</h4><p className="text-white">Go 1.23</p><p className="text-gray-500">Gorilla Mux, WebSocket</p></div>
          <div><h4 className="text-gray-400 mb-1">Messaging</h4><p className="text-white">NATS + JetStream</p><p className="text-gray-500">Pub/Sub, persistence</p></div>
          <div><h4 className="text-gray-400 mb-1">Orchestration</h4><p className="text-white">Kubernetes CRDs</p><p className="text-gray-500">Custom operator</p></div>
        </div>
      </div>
    </div>
  )
}
