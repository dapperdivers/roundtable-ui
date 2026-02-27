// Knight metadata and display config
export const KNIGHT_CONFIG: Record<string, {
  emoji: string
  color: string
  title: string
}> = {
  galahad: { emoji: '🛡️', color: 'text-red-400', title: 'Security' },
  kay: { emoji: '📡', color: 'text-blue-400', title: 'Research' },
  tristan: { emoji: '🏗️', color: 'text-cyan-400', title: 'Infrastructure' },
  gawain: { emoji: '☀️', color: 'text-yellow-400', title: 'Orchestrator' },
  agravain: { emoji: '🗡️', color: 'text-orange-400', title: 'Pentest' },
  bedivere: { emoji: '🏠', color: 'text-green-400', title: 'Home' },
  percival: { emoji: '📋', color: 'text-purple-400', title: 'Finance' },
  patsy: { emoji: '🥥', color: 'text-amber-400', title: 'Vault' },
  gareth: { emoji: '🌿', color: 'text-emerald-400', title: 'Wellness' },
  lancelot: { emoji: '⚔️', color: 'text-indigo-400', title: 'Career' },
}

export function getKnightConfig(name: string) {
  return KNIGHT_CONFIG[name] || { emoji: '🤖', color: 'text-gray-400', title: name }
}
