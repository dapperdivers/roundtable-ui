// Knight metadata and display config
export const KNIGHT_CONFIG: Record<string, {
  emoji: string
  color: string
  title: string
  domain: string
}> = {
  galahad: { emoji: '🛡️', color: 'text-red-400', title: 'Security', domain: 'security' },
  kay: { emoji: '📡', color: 'text-blue-400', title: 'Research', domain: 'research' },
  tristan: { emoji: '🏗️', color: 'text-cyan-400', title: 'Infrastructure', domain: 'infra' },
  gawain: { emoji: '☀️', color: 'text-yellow-400', title: 'Orchestrator', domain: 'project' },
  agravain: { emoji: '🗡️', color: 'text-orange-400', title: 'Pentest', domain: 'pentest' },
  bedivere: { emoji: '🏠', color: 'text-green-400', title: 'Home', domain: 'home' },
  percival: { emoji: '📋', color: 'text-purple-400', title: 'Finance', domain: 'finance' },
  patsy: { emoji: '🥥', color: 'text-amber-400', title: 'Vault', domain: 'vault' },
  gareth: { emoji: '🌿', color: 'text-emerald-400', title: 'Wellness', domain: 'wellness' },
  lancelot: { emoji: '⚔️', color: 'text-indigo-400', title: 'Career', domain: 'career' },
}

export function getKnightConfig(name: string) {
  return KNIGHT_CONFIG[name] || { emoji: '🤖', color: 'text-gray-400', title: name, domain: name }
}

export function getKnightByDomain(domain: string) {
  return Object.entries(KNIGHT_CONFIG).find(([, c]) => c.domain === domain)
}

/** Get (x, y) position for a knight on a circle */
export function getKnightPosition(index: number, total: number, cx: number, cy: number, radius: number) {
  const angle = (2 * Math.PI * index) / total - Math.PI / 2 // start from top
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  }
}

/** All knight names in order */
export const KNIGHT_NAMES = Object.keys(KNIGHT_CONFIG)

/** Map domain -> knight name */
export function knightNameForDomain(domainOrName: string): string | null {
  // Direct knight name match first
  if (KNIGHT_CONFIG[domainOrName]) return domainOrName
  // Then try domain lookup
  const entry = Object.entries(KNIGHT_CONFIG).find(([, c]) => c.domain === domainOrName)
  return entry ? entry[0] : null
}
