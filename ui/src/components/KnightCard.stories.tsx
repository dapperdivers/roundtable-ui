import type { Meta, StoryObj } from '@storybook/react'
import { KnightCard } from './KnightCard'
import type { Knight } from '../hooks/useFleet'

const meta: Meta<typeof KnightCard> = {
  title: 'Components/KnightCard',
  component: KnightCard,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof KnightCard>

const baseKnight: Knight = {
  name: 'galahad',
  domain: 'security',
  status: 'online',
  ready: true,
  restarts: 0,
  age: '3d 12h',
  image: 'ghcr.io/roundtable/knight:latest',
  skills: 4,
  nixTools: 7,
  labels: {},
}

export const OnlineReady: Story = {
  args: {
    knight: baseKnight,
  },
}

export const OfflineNotReady: Story = {
  args: {
    knight: { ...baseKnight, name: 'tristan', domain: 'infra', status: 'offline', ready: false, restarts: 3, age: '1h 20m' },
  },
}

export const Starting: Story = {
  args: {
    knight: { ...baseKnight, name: 'percival', domain: 'finance', status: 'starting', ready: false, restarts: 1, age: '2m' },
  },
}

export const BusyWithActivity: Story = {
  args: {
    knight: { ...baseKnight, name: 'gawain', domain: 'project', status: 'busy' },
    activity: {
      recent: 5,
      lastActive: new Date().toISOString(),
      busy: true,
      sparkline: [0.2, 0.5, 0.8, 1.0, 0.6, 0.3, 0.9],
    },
  },
}

export const IdleWithActivity: Story = {
  args: {
    knight: { ...baseKnight, name: 'kay', domain: 'research' },
    activity: {
      recent: 0,
      lastActive: new Date(Date.now() - 3600000).toISOString(),
      busy: false,
      sparkline: [0.1, 0, 0, 0, 0, 0, 0],
    },
  },
}

export const HighRestarts: Story = {
  args: {
    knight: { ...baseKnight, name: 'agravain', domain: 'pentest', status: 'online', restarts: 12, age: '6h 45m' },
  },
}

export const WithPhaseBadge: Story = {
  args: {
    knight: { 
      ...baseKnight, 
      name: 'lancelot', 
      domain: 'career', 
      status: 'online', 
      phase: 'Ready',
      model: 'claude-sonnet-4-20250514',
      tasksCompleted: 42,
      totalCost: '$2.34'
    },
  },
}

export const SuspendedKnight: Story = {
  args: {
    knight: { 
      ...baseKnight, 
      name: 'patsy', 
      domain: 'vault', 
      status: 'offline', 
      ready: false,
      phase: 'Suspended',
      suspended: true,
      model: 'claude-sonnet-4-20250514'
    },
  },
}

export const SandboxRuntime: Story = {
  args: {
    knight: { 
      ...baseKnight, 
      name: 'coder-1', 
      domain: 'coding', 
      status: 'online',
      runtime: 'sandbox',
      model: 'claude-sonnet-4-20250514',
      tasksCompleted: 15,
      totalCost: '$0.87',
      concurrency: 3
    },
  },
}

export const WithPerformanceMetrics: Story = {
  args: {
    knight: { 
      ...baseKnight, 
      name: 'gawain', 
      domain: 'project', 
      status: 'busy',
      phase: 'Ready',
      model: 'claude-sonnet-4-20250514',
      runtime: 'deployment',
      tasksCompleted: 128,
      tasksFailed: 5,
      totalCost: '$15.67',
      concurrency: 5,
      taskTimeout: 600,
      skillsList: ['terraform', 'kubectl', 'aws-cli', 'gh']
    },
    activity: {
      recent: 8,
      lastActive: new Date().toISOString(),
      busy: true,
      sparkline: [0.3, 0.5, 0.7, 0.9, 1.0, 0.8, 0.6],
    },
  },
}

export const DegradedPhase: Story = {
  args: {
    knight: { 
      ...baseKnight, 
      name: 'tristan', 
      domain: 'infra', 
      status: 'online',
      ready: false,
      phase: 'Degraded',
      restarts: 8,
      model: 'claude-sonnet-4-20250514'
    },
  },
}
