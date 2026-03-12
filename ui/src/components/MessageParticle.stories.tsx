import type { Meta, StoryObj } from '@storybook/react'
import { MessageParticle } from './MessageParticle'

const meta: Meta<typeof MessageParticle> = {
  title: 'Components/MessageParticle',
  component: MessageParticle,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <svg viewBox="0 0 400 200" className="w-full max-w-lg border border-gray-700 rounded-lg bg-slate-900">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <Story />
      </svg>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof MessageParticle>

export const TaskParticle: Story = {
  args: {
    fromX: 50,
    fromY: 100,
    toX: 350,
    toY: 100,
    color: '#60a5fa',
    duration: 2000,
    onDone: () => {},
  },
}

export const ResultParticle: Story = {
  args: {
    fromX: 350,
    fromY: 50,
    toX: 50,
    toY: 150,
    color: '#4ade80',
    duration: 2000,
    onDone: () => {},
  },
}

export const FastParticle: Story = {
  args: {
    fromX: 50,
    fromY: 50,
    toX: 350,
    toY: 150,
    color: '#f87171',
    duration: 600,
    onDone: () => {},
  },
}
