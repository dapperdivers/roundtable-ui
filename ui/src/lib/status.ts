/**
 * Single source of truth for phase → badge colors across every resource
 * (Mission, Chain, ChainStep, RoundTable, Knight). Previously each page
 * carried its own partial, drifting copy of this map.
 */

const PHASE_COLORS: Record<string, string> = {
  // Waiting / neutral
  Idle: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  Pending: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  Unknown: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  Skipped: 'bg-gray-500/20 text-gray-500 border-gray-500/30',
  Expired: 'bg-gray-500/20 text-gray-500 border-gray-500/30',

  // In progress
  Provisioning: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Running: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  StepRunning: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Active: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Planning: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  Assembling: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  Briefing: 'bg-purple-500/20 text-purple-400 border-purple-500/30',

  // Healthy / done
  Ready: 'bg-green-500/20 text-green-400 border-green-500/30',
  Succeeded: 'bg-green-500/20 text-green-400 border-green-500/30',
  Completed: 'bg-green-500/20 text-green-400 border-green-500/30', // legacy alias

  // Degraded
  Degraded: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  PartiallySucceeded: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',

  // Paused / cleanup
  Paused: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  Suspended: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  CleaningUp: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  OverBudget: 'bg-orange-500/20 text-orange-400 border-orange-500/30',

  // Failed
  Failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  Error: 'bg-red-500/20 text-red-400 border-red-500/30',
}

export function phaseColor(phase: string): string {
  return PHASE_COLORS[phase] || PHASE_COLORS.Pending
}

/** Knight liveness dot colors (KnightCard pulsing indicator). */
export const KNIGHT_STATUS_DOT: Record<string, string> = {
  online: 'bg-green-500',
  offline: 'bg-red-500',
  starting: 'bg-yellow-500',
  busy: 'bg-blue-500',
}
