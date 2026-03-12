import type { Meta, StoryObj } from '@storybook/react'
import { KnightDetailDrawer } from './KnightDetailDrawer'
import type { Knight } from '../hooks/useFleet'

const meta: Meta<typeof KnightDetailDrawer> = {
  title: 'Components/KnightDetailDrawer',
  component: KnightDetailDrawer,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
}
export default meta

type Story = StoryObj<typeof KnightDetailDrawer>

const mockKnight: Knight = {
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

export const Open: Story = {
  args: {
    knight: mockKnight,
    onClose: () => {},
  },
}

export const OfflineKnight: Story = {
  args: {
    knight: { ...mockKnight, name: 'tristan', domain: 'infra', status: 'offline', ready: false, restarts: 5, age: '45m' },
    onClose: () => {},
  },
}

export const Closed: Story = {
  args: {
    knight: null,
    onClose: () => {},
  },
}
