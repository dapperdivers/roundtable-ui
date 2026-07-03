import { usePolledFetch } from './usePolledFetch'

export interface PlanningResult {
  completedAt: string
  chainsGenerated: number
  knightsGenerated: number
  skillsGenerated: number
  error?: string
  rawOutput?: string
  reasoning?: string
}

export interface KnightStatus {
  name: string
  ready: boolean
  tasksCompleted: number
  ephemeral: boolean
}

export interface ChainStatus {
  name: string
  chainCRName: string
  phase: string
}

export interface Mission {
  name: string
  namespace: string
  phase: string
  objective: string
  startedAt: string | null
  expiresAt: string | null
  knights: string[]
  chains: string[]
  costBudgetUSD: string
  totalCost: string
  ttl: number
  timeout: number
  roundTableRef: string
  metaMission?: boolean
  planningResult?: PlanningResult
  knightStatuses?: KnightStatus[]
  chainStatuses?: ChainStatus[]
  completedAt?: string
  successCriteria?: string
  briefing?: string
}

export function useMissions(refreshInterval = 10000) {
  const { data: missions, loading, error, refresh } = usePolledFetch<Mission[]>('/api/missions', refreshInterval, [])
  return { missions, loading, error, refresh }
}
