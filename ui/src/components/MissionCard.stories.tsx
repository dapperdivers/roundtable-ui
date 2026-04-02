import type { Meta, StoryObj } from '@storybook/react'
import { MissionCard } from './MissionCard'
import type { Mission } from '../hooks/useMissions'

const meta: Meta<typeof MissionCard> = {
  title: 'Components/MissionCard',
  component: MissionCard,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="max-w-lg">
        <Story />
      </div>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof MissionCard>

const baseMission: Mission = {
  name: 'security-audit-2026',
  namespace: 'roundtable',
  phase: 'Active',
  objective: 'Perform a comprehensive security audit of all cluster services',
  startedAt: new Date(Date.now() - 3600000).toISOString(),
  expiresAt: new Date(Date.now() + 7200000).toISOString(),
  knights: ['galahad', 'agravain', 'tristan'],
  chains: ['scan-services', 'check-rbac', 'report'],
  costBudgetUSD: '5.00',
  totalCost: '1.23',
  ttl: 3600,
  timeout: 600,
  roundTableRef: 'roundtable-alpha',
}

export const Active: Story = {
  args: { mission: baseMission },
}

export const Succeeded: Story = {
  args: {
    mission: { ...baseMission, name: 'infra-deploy-v2', phase: 'Succeeded', objective: 'Deploy infrastructure v2 across all regions', totalCost: '4.50' },
  },
}

export const Failed: Story = {
  args: {
    mission: { ...baseMission, name: 'cost-analysis-q1', phase: 'Failed', objective: 'Analyze Q1 cloud spending and identify savings', totalCost: '2.80', costBudgetUSD: '3.00' },
  },
}

export const Pending: Story = {
  args: {
    mission: { ...baseMission, name: 'wellness-check', phase: 'Pending', objective: 'Run wellness diagnostics on all knight pods', startedAt: null, knights: ['gareth', 'bedivere'], chains: ['check-health'], totalCost: '0.00' },
  },
}

export const OverBudget: Story = {
  args: {
    mission: { ...baseMission, name: 'deep-research', phase: 'Active', objective: 'Deep research into Kubernetes operator patterns', totalCost: '4.95', costBudgetUSD: '5.00', knights: ['kay', 'lancelot'] },
  },
}

export const ManyKnights: Story = {
  args: {
    mission: { ...baseMission, name: 'full-table-mission', objective: 'Coordinate all knights for system-wide audit', knights: ['galahad', 'tristan', 'gawain', 'percival', 'kay', 'lancelot'], chains: ['phase-1', 'phase-2', 'phase-3', 'phase-4'] },
  },
}

export const WithKnightStatuses: Story = {
  args: {
    mission: {
      ...baseMission,
      name: 'deployment-mission',
      objective: 'Deploy new microservices across all environments',
      phase: 'Active',
      knights: ['tristan', 'gawain', 'percival'],
      knightStatuses: [
        { name: 'tristan', ready: true, tasksCompleted: 12, ephemeral: false },
        { name: 'gawain', ready: true, tasksCompleted: 8, ephemeral: false },
        { name: 'percival', ready: true, tasksCompleted: 5, ephemeral: true },
      ],
      totalCost: '3.45',
    },
  },
}

export const WithChainStatuses: Story = {
  args: {
    mission: {
      ...baseMission,
      name: 'multi-chain-mission',
      objective: 'Orchestrate complex multi-step deployment',
      phase: 'Active',
      chains: ['prepare-env', 'deploy-services', 'verify-health', 'cleanup'],
      chainStatuses: [
        { name: 'prepare-env', chainCRName: 'mission-abc-prepare-env', phase: 'Succeeded' },
        { name: 'deploy-services', chainCRName: 'mission-abc-deploy-services', phase: 'Running' },
        { name: 'verify-health', chainCRName: 'mission-abc-verify-health', phase: 'Idle' },
        { name: 'cleanup', chainCRName: 'mission-abc-cleanup', phase: 'Idle' },
      ],
      totalCost: '2.67',
    },
  },
}

export const CompletedMission: Story = {
  args: {
    mission: {
      ...baseMission,
      name: 'research-project',
      objective: 'Research and document Kubernetes operator best practices',
      phase: 'Succeeded',
      startedAt: new Date(Date.now() - 7200000).toISOString(),
      completedAt: new Date(Date.now() - 600000).toISOString(),
      knights: ['kay', 'lancelot'],
      knightStatuses: [
        { name: 'kay', ready: true, tasksCompleted: 24, ephemeral: false },
        { name: 'lancelot', ready: true, tasksCompleted: 18, ephemeral: false },
      ],
      chainStatuses: [
        { name: 'research', chainCRName: 'mission-xyz-research', phase: 'Succeeded' },
        { name: 'document', chainCRName: 'mission-xyz-document', phase: 'Succeeded' },
        { name: 'review', chainCRName: 'mission-xyz-review', phase: 'Succeeded' },
      ],
      totalCost: '8.92',
      costBudgetUSD: '10.00',
    },
  },
}

export const MetaMissionWithPlanning: Story = {
  args: {
    mission: {
      ...baseMission,
      name: 'meta-security-audit',
      objective: 'Plan and execute a comprehensive security audit of the entire infrastructure',
      phase: 'Succeeded',
      metaMission: true,
      planningResult: {
        completedAt: new Date(Date.now() - 3600000).toISOString(),
        chainsGenerated: 5,
        knightsGenerated: 3,
        skillsGenerated: 7,
        reasoning: 'Generated chains for vulnerability scanning, compliance checking, penetration testing, incident response planning, and security documentation. Created specialized knights with security tooling.',
        rawOutput: 'Planning output: Generated 5 chains and 3 ephemeral knights with 7 custom skills for comprehensive security coverage.',
      },
      knights: ['galahad', 'agravain', 'security-scanner-1'],
      chains: ['vuln-scan', 'compliance-check', 'pentest', 'incident-response', 'docs'],
      knightStatuses: [
        { name: 'galahad', ready: true, tasksCompleted: 45, ephemeral: false },
        { name: 'agravain', ready: true, tasksCompleted: 32, ephemeral: false },
        { name: 'security-scanner-1', ready: true, tasksCompleted: 28, ephemeral: true },
      ],
      chainStatuses: [
        { name: 'vuln-scan', chainCRName: 'meta-mission-vuln-scan', phase: 'Succeeded' },
        { name: 'compliance-check', chainCRName: 'meta-mission-compliance', phase: 'Succeeded' },
        { name: 'pentest', chainCRName: 'meta-mission-pentest', phase: 'Succeeded' },
        { name: 'incident-response', chainCRName: 'meta-mission-incident', phase: 'Succeeded' },
        { name: 'docs', chainCRName: 'meta-mission-docs', phase: 'Succeeded' },
      ],
      totalCost: '18.45',
      costBudgetUSD: '20.00',
      completedAt: new Date(Date.now() - 300000).toISOString(),
      briefing: 'Comprehensive security audit including vulnerability scanning, compliance verification, penetration testing, and incident response planning.',
    },
  },
}

export const MetaMissionPlanning: Story = {
  args: {
    mission: {
      ...baseMission,
      name: 'meta-infra-migration',
      objective: 'Plan migration of legacy infrastructure to modern cloud-native architecture',
      phase: 'Planning',
      metaMission: true,
      knights: [],
      chains: [],
      totalCost: '0.25',
      briefing: 'Analyze current infrastructure, design migration strategy, and generate execution plan.',
    },
  },
}

export const FailedMetaMission: Story = {
  args: {
    mission: {
      ...baseMission,
      name: 'meta-budget-exceeded',
      objective: 'Plan and execute cost optimization across all services',
      phase: 'Failed',
      metaMission: true,
      planningResult: {
        completedAt: new Date(Date.now() - 1800000).toISOString(),
        chainsGenerated: 0,
        knightsGenerated: 0,
        skillsGenerated: 0,
        error: 'Planning failed: Cost budget exceeded during planning phase. Required $15.00, budget was $10.00',
      },
      totalCost: '10.00',
      costBudgetUSD: '10.00',
    },
  },
}
