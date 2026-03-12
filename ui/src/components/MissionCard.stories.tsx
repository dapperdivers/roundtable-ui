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
