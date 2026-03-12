import { Network, Server, Globe, MessageSquare, Shield, Crown, Cpu } from 'lucide-react'

interface ComponentNode {
  id: string
  label: string
  description: string
  icon: React.ReactNode
  color: string
  connections: string[]
}

const COMPONENTS: ComponentNode[] = [
  { id: 'ui', label: 'Dashboard UI', description: 'React SPA — observability & control plane', icon: <Globe className="w-6 h-6" />, color: 'text-blue-400 border-blue-500/30 bg-blue-500/10', connections: ['api'] },
  { id: 'api', label: 'Dashboard API', description: 'Go API — proxies K8s & NATS to the UI', icon: <Server className="w-6 h-6" />, color: 'text-green-400 border-green-500/30 bg-green-500/10', connections: ['nats', 'k8s'] },
  { id: 'k8s', label: 'Kubernetes API', description: 'Cluster state — pods, CRDs (Missions, Chains, RoundTables)', icon: <Cpu className="w-6 h-6" />, color: 'text-purple-400 border-purple-500/30 bg-purple-500/10', connections: ['knights', 'operator'] },
  { id: 'nats', label: 'NATS / JetStream', description: 'Message bus — tasks, results, mission events', icon: <MessageSquare className="w-6 h-6" />, color: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10', connections: ['knights'] },
  { id: 'operator', label: 'RoundTable Operator', description: 'Manages Missions, Chains, and RoundTable CRDs', icon: <Crown className="w-6 h-6" />, color: 'text-roundtable-gold border-roundtable-gold/30 bg-roundtable-gold/10', connections: ['k8s', 'nats'] },
  { id: 'knights', label: 'Knights (Agents)', description: 'AI agents — execute tasks, report results', icon: <Shield className="w-6 h-6" />, color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10', connections: ['nats'] },
]

export function ArchitecturePage() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Network className="w-8 h-8 text-roundtable-gold" />
        <h1 className="text-3xl font-bold text-white">Architecture</h1>
      </div>
      <p className="text-gray-400 mb-8 max-w-2xl">
        The Round Table system consists of a Kubernetes operator managing AI agent fleets,
        connected via NATS messaging and observed through this dashboard.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
        {COMPONENTS.map(comp => (
          <div key={comp.id} className={`rounded-xl border p-5 ${comp.color} transition-all hover:scale-[1.02]`}>
            <div className="flex items-center gap-3 mb-3">{comp.icon}<h3 className="text-lg font-bold">{comp.label}</h3></div>
            <p className="text-sm opacity-80 mb-3">{comp.description}</p>
            {comp.connections.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {comp.connections.map(c => {
                  const target = COMPONENTS.find(x => x.id === c)
                  return <span key={c} className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10">→ {target?.label || c}</span>
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
