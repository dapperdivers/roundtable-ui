import type { Meta, StoryObj } from '@storybook/react'
import { RoundTableGraph } from './RoundTableGraph'
import type { NatsEvent } from '../hooks/useWebSocket'

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
