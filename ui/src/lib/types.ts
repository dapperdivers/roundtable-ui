/**
 * Shared domain types matching the Go API's response DTOs
 * (api/main.go RoundTableSummary, ChainSummary, StepSummary).
 * Knight and Mission live with their data hooks (useFleet, useMissions).
 */

export interface RoundTable {
  name: string
  namespace: string
  phase: string
  knightsReady: number
  knightsTotal: number
  natsPrefix: string
  costBudgetUSD: string
  totalCost: string
  warmPool?: {
    available: number
    provisioning: number
    claimed: number
  }
  policies?: {
    maxConcurrentTasks: number
    costBudgetUSD: string
    maxKnights: number
    maxMissions: number
  }
  activeMissions?: number
  totalTasksCompleted?: number
  description?: string
  suspended?: boolean
  ephemeral?: boolean
}

export interface ChainStep {
  name: string
  knight: string
  domain: string
  phase: string
  startTime?: string
  completionTime?: string
  result?: string
  dependsOn?: string[]
  retryCount?: number
}

export interface Chain {
  name: string
  namespace: string
  phase: string
  currentStep?: string
  startTime?: string
  completionTime?: string
  steps: ChainStep[]
  schedule?: string
}
