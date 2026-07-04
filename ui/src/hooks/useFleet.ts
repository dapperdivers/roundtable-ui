import { usePolledFetch } from './usePolledFetch'

export interface KnightCondition {
  type: string
  status: string
  reason?: string
  message?: string
  lastTransitionTime?: string
}

export interface GeneratedSkill {
  name: string
  content: string
}

export interface Knight {
  name: string
  domain: string
  status: 'online' | 'offline' | 'starting' | 'busy'
  ready: boolean
  restarts: number
  age: string
  image: string
  skills: number           // keep for backward compat
  skillsList?: string[]    // actual skill names from CRD
  nixTools: number         // keep for backward compat
  nixPackages?: string[]
  generatedSkills?: GeneratedSkill[]
  labels: Record<string, string>
  // fields from Knight CRD:
  phase?: string           // Pending | Provisioning | Ready | Degraded | Suspended
  model?: string           // e.g. claude-sonnet-4-20250514
  runtime?: string         // deployment | sandbox
  suspended?: boolean
  tasksCompleted?: number
  tasksFailed?: number
  totalCost?: string
  concurrency?: number
  taskTimeout?: number
  conditions?: KnightCondition[]
}

export function useFleet(refreshInterval = 10000) {
  const { data: knights, loading, error, refresh } = usePolledFetch<Knight[]>('/api/fleet', refreshInterval, [])
  return { knights, loading, error, refresh }
}
