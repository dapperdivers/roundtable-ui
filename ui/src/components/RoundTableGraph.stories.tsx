import type { Meta, StoryObj } from '@storybook/react'
import { RoundTableGraph } from './RoundTableGraph'
import type { NatsEvent } from '../hooks/useWebSocket'
import type { Knight } from '../hooks/useFleet'

const meta: Meta<typeof RoundTableGraph> = {
  title: 'Components/RoundTableGraph',
  component: RoundTableGraph,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="max-w-[600px] mx-auto">
        <Story />
      </div>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof RoundTableGraph>

const mockKnights: Knight[] = [
  { name: 'galahad', domain: 'security', status: 'online', ready: true, restarts: 0, age: '3d', image: 'ghcr.io/roundtable/knight:latest', skills: 4, nixTools: 7, labels: {}, phase: 'Ready', model: 'claude-sonnet-4-20250514' },
  { name: 'kay', domain: 'research', status: 'online', ready: true, restarts: 0, age: '3d', image: 'ghcr.io/roundtable/knight:latest', skills: 5, nixTools: 8, labels: {}, phase: 'Ready', model: 'claude-sonnet-4-20250514' },
  { name: 'tristan', domain: 'infra', status: 'online', ready: true, restarts: 1, age: '2d', image: 'ghcr.io/roundtable/knight:latest', skills: 6, nixTools: 10, labels: {}, phase: 'Ready', model: 'claude-sonnet-4-20250514' },
  { name: 'gawain', domain: 'project', status: 'online', ready: true, restarts: 0, age: '4d', image: 'ghcr.io/roundtable/knight:latest', skills: 3, nixTools: 5, labels: {}, phase: 'Ready', model: 'claude-sonnet-4-20250514' },
  { name: 'agravain', domain: 'pentest', status: 'offline', ready: false, restarts: 5, age: '1h', image: 'ghcr.io/roundtable/knight:latest', skills: 4, nixTools: 6, labels: {}, phase: 'Degraded' },
  { name: 'bedivere', domain: 'home', status: 'online', ready: true, restarts: 0, age: '5d', image: 'ghcr.io/roundtable/knight:latest', skills: 2, nixTools: 4, labels: {}, phase: 'Ready', model: 'claude-sonnet-4-20250514' },
  { name: 'percival', domain: 'finance', status: 'online', ready: true, restarts: 0, age: '3d', image: 'ghcr.io/roundtable/knight:latest', skills: 3, nixTools: 5, labels: {}, phase: 'Ready', model: 'claude-sonnet-4-20250514' },
  { name: 'patsy', domain: 'vault', status: 'offline', ready: false, restarts: 0, age: '12h', image: 'ghcr.io/roundtable/knight:latest', skills: 1, nixTools: 3, labels: {}, phase: 'Suspended', suspended: true },
  { name: 'gareth', domain: 'wellness', status: 'online', ready: true, restarts: 0, age: '2d', image: 'ghcr.io/roundtable/knight:latest', skills: 2, nixTools: 4, labels: {}, phase: 'Ready', model: 'claude-sonnet-4-20250514' },
  { name: 'lancelot', domain: 'career', status: 'online', ready: true, restarts: 2, age: '6d', image: 'ghcr.io/roundtable/knight:latest', skills: 4, nixTools: 6, labels: {}, phase: 'Ready', model: 'claude-sonnet-4-20250514' },
  { name: 'coder-1', domain: 'coding', status: 'online', ready: true, restarts: 0, age: '1d', image: 'ghcr.io/roundtable/knight:latest', skills: 3, nixTools: 8, labels: {}, phase: 'Ready', model: 'claude-sonnet-4-20250514', runtime: 'sandbox' },
  { name: 'coder-2', domain: 'coding', status: 'offline', ready: false, restarts: 3, age: '8h', image: 'ghcr.io/roundtable/knight:latest', skills: 3, nixTools: 8, labels: {}, phase: 'Provisioning', runtime: 'sandbox' },
]

const knightStatuses: Record<string, string> = {
  galahad: 'online',
  kay: 'online',
  tristan: 'online',
  gawain: 'online',
  agravain: 'offline',
  bedivere: 'online',
  percival: 'online',
  patsy: 'offline',
  gareth: 'online',
  lancelot: 'online',
  'coder-1': 'online',
  'coder-2': 'offline',
}

export const Idle: Story = {
  args: {
    knights: mockKnights,
    events: [],
    connected: true,
    knightStatuses,
  },
}

const mockEvents: NatsEvent[] = [
  { type: 'task', subject: 'rt.tasks.security.audit', data: JSON.stringify({ from: 'tim', task_id: 't1' }), timestamp: new Date().toISOString() },
  { type: 'result', subject: 'rt.results.security.audit', data: JSON.stringify({ knight: 'galahad', task_id: 't1' }), timestamp: new Date().toISOString() },
  { type: 'task', subject: 'rt.tasks.infra.provision', data: JSON.stringify({ from: 'security', task_id: 't2' }), timestamp: new Date().toISOString() },
]

export const WithMessages: Story = {
  args: {
    knights: mockKnights,
    events: mockEvents,
    connected: true,
    knightStatuses,
  },
}

export const Disconnected: Story = {
  args: {
    knights: mockKnights.map(k => ({ ...k, status: 'offline' as const, ready: false })),
    events: [],
    connected: false,
    knightStatuses: Object.fromEntries(Object.keys(knightStatuses).map((k) => [k, 'offline'])),
  },
}
