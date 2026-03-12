import type { Meta, StoryObj } from '@storybook/react'
import { MissionPhaseBadge } from './MissionPhaseBadge'

const meta: Meta<typeof MissionPhaseBadge> = {
  title: 'Components/MissionPhaseBadge',
  component: MissionPhaseBadge,
  tags: ['autodocs'],
}
export default meta

type Story = StoryObj<typeof MissionPhaseBadge>

export const Pending: Story = { args: { phase: 'Pending' } }
export const Provisioning: Story = { args: { phase: 'Provisioning' } }
export const Assembling: Story = { args: { phase: 'Assembling' } }
export const Briefing: Story = { args: { phase: 'Briefing' } }
export const Active: Story = { args: { phase: 'Active' } }
export const Succeeded: Story = { args: { phase: 'Succeeded' } }
export const Failed: Story = { args: { phase: 'Failed' } }
export const CleaningUp: Story = { args: { phase: 'CleaningUp' } }
export const Expired: Story = { args: { phase: 'Expired' } }

export const AllPhases: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {['Pending', 'Provisioning', 'Assembling', 'Briefing', 'Active', 'Succeeded', 'Failed', 'CleaningUp', 'Expired'].map(
        (phase) => (
          <MissionPhaseBadge key={phase} phase={phase} />
        ),
      )}
    </div>
  ),
}
