const phaseColors: Record<string, string> = {
  Pending: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  Provisioning: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Planning: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  Assembling: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  Briefing: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  Active: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Succeeded: 'bg-green-500/20 text-green-400 border-green-500/30',
  Failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  CleaningUp: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  Expired: 'bg-gray-500/20 text-gray-500 border-gray-500/30',
}

export function MissionPhaseBadge({ phase }: { phase: string }) {
  const cls = phaseColors[phase] || phaseColors.Pending
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${cls}`}>
      {phase}
    </span>
  )
}
