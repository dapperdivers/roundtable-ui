import type { Meta, StoryObj } from '@storybook/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FleetGraph } from './FleetGraph'
import type { NatsEvent } from '../hooks/useWebSocket'

const meta: Meta<typeof FleetGraph> = {
  title: 'Components/FleetGraph',
  component: FleetGraph,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <ReactFlowProvider>
        <Story />
      </ReactFlowProvider>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
  },
}
export default meta

type Story = StoryObj<typeof FleetGraph>

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

export const Empty: Story = {
  args: {
    events: [],
    connected: true,
    knightStatuses,
  },
}

const mockEvents: NatsEvent[] = [
  { type: 'task', subject: 'rt.tasks.security.scan', data: JSON.stringify({ from: 'tim', task_id: 't1' }), timestamp: new Date().toISOString() },
  { type: 'result', subject: 'rt.results.security.scan', data: JSON.stringify({ knight: 'galahad', task_id: 't1' }), timestamp: new Date().toISOString() },
  { type: 'task', subject: 'rt.tasks.infra.deploy', data: JSON.stringify({ from: 'security', task_id: 't2' }), timestamp: new Date().toISOString() },
  { type: 'task', subject: 'rt.tasks.research.analyze', data: JSON.stringify({ from: 'tim', task_id: 't3' }), timestamp: new Date().toISOString() },
]

export const WithActivity: Story = {
  args: {
    events: mockEvents,
    connected: true,
    knightStatuses,
  },
}

export const Disconnected: Story = {
  args: {
    events: [],
    connected: false,
    knightStatuses: Object.fromEntries(Object.keys(knightStatuses).map((k) => [k, 'offline'])),
  },
}
