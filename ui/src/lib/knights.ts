// Knight metadata and display config
export interface KnightDisplayConfig {
  emoji: string
  color: string
  title: string
  domain: string
}

export const KNIGHT_CONFIG: Record<string, KnightDisplayConfig> = {
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
  'coder-1': { emoji: '💻', color: 'text-sky-400', title: 'Coder', domain: 'coding' },
  'coder-2': { emoji: '💻', color: 'text-sky-400', title: 'Coder', domain: 'coding' },
}

const DOMAIN_EMOJI: Record<string, string> = {
  security: '🛡️', research: '📡', infra: '🏗️', project: '☀️',
  pentest: '🗡️', home: '🏠', finance: '📋', vault: '🥥',
  wellness: '🌿', career: '⚔️', coding: '💻', lead: '👑',
  backend: '⚙️', frontend: '🎨', data: '📊', qa: '🧪',
  devops: '🔧', planning: '🗺️', turtle: '🐢',
}

const DOMAIN_COLOR: Record<string, string> = {
  security: 'text-red-400', research: 'text-blue-400', infra: 'text-cyan-400',
  project: 'text-yellow-400', pentest: 'text-orange-400', home: 'text-green-400',
  finance: 'text-purple-400', vault: 'text-amber-400', wellness: 'text-emerald-400',
  career: 'text-indigo-400', coding: 'text-sky-400', lead: 'text-yellow-300',
  backend: 'text-teal-400', frontend: 'text-pink-400', data: 'text-violet-400',
  qa: 'text-lime-400', devops: 'text-orange-300', planning: 'text-rose-400',
  turtle: 'text-emerald-300',
}

// Build dynamic config from fleet API response, using KNIGHT_CONFIG as fallback
export function buildKnightConfigFromFleet(knights: Array<{ name: string; domain: string }>): Record<string, KnightDisplayConfig> {
  const config = { ...KNIGHT_CONFIG }
  for (const knight of knights) {
    if (!config[knight.name]) {
      config[knight.name] = {
        emoji: DOMAIN_EMOJI[knight.domain] || '🤖',
        color: DOMAIN_COLOR[knight.domain] || 'text-gray-400',
        title: knight.domain.charAt(0).toUpperCase() + knight.domain.slice(1),
        domain: knight.domain,
      }
    }
  }
  return config
}

export function getKnightConfig(name: string): KnightDisplayConfig {
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

/** All knight names in order (static config only; pass fleet data to buildKnightConfigFromFleet for dynamic names) */
export const KNIGHT_NAMES = Object.keys(KNIGHT_CONFIG)

/** Get all knight names including any dynamic ones from fleet data */
export function getKnightNames(knights?: Array<{ name: string; domain: string }>): string[] {
  if (!knights) return KNIGHT_NAMES
  const dynamic = buildKnightConfigFromFleet(knights)
  return Object.keys(dynamic)
}

/** Map domain -> knight name */
export function knightNameForDomain(domainOrName: string): string | null {
  // Direct knight name match first
  if (KNIGHT_CONFIG[domainOrName]) return domainOrName
  // Then try domain lookup
  const entry = Object.entries(KNIGHT_CONFIG).find(([, c]) => c.domain === domainOrName)
  return entry ? entry[0] : null
}
