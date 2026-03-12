import type { Meta, StoryObj } from '@storybook/react'
import { ToastProvider, useToast } from './Toast'
import { useEffect } from 'react'

const meta: Meta = {
  title: 'Components/Toast',
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
      </ToastProvider>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
  },
}
export default meta

type Story = StoryObj

function ToastTrigger({ message, type }: { message: string; type: 'success' | 'info' | 'warning' | 'error' }) {
  const { addToast } = useToast()
  return (
    <button
      onClick={() => addToast(message, type)}
      className="px-4 py-2 rounded-lg bg-roundtable-slate border border-roundtable-steel text-white text-sm hover:border-roundtable-gold/30 transition-colors"
    >
      Show {type} toast
    </button>
  )
}

function AutoToast({ message, type }: { message: string; type: 'success' | 'info' | 'warning' | 'error' }) {
  const { addToast } = useToast()
  useEffect(() => {
    addToast(message, type)
  }, [])
  return null
}

export const Success: Story = {
  render: () => (
    <>
      <AutoToast message="Mission completed successfully!" type="success" />
      <div className="p-8">
        <ToastTrigger message="Mission completed successfully!" type="success" />
      </div>
    </>
  ),
}

export const Error: Story = {
  render: () => (
    <>
      <AutoToast message="Knight galahad failed to respond" type="error" />
      <div className="p-8">
        <ToastTrigger message="Knight galahad failed to respond" type="error" />
      </div>
    </>
  ),
}

export const Warning: Story = {
  render: () => (
    <>
      <AutoToast message="Budget usage at 90% for mission security-audit" type="warning" />
      <div className="p-8">
        <ToastTrigger message="Budget usage at 90%" type="warning" />
      </div>
    </>
  ),
}

export const Info: Story = {
  render: () => (
    <>
      <AutoToast message="New mission briefing available" type="info" />
      <div className="p-8">
        <ToastTrigger message="New mission briefing available" type="info" />
      </div>
    </>
  ),
}

export const AllTypes: Story = {
  render: () => (
    <div className="p-8 flex flex-wrap gap-3">
      <ToastTrigger message="Deployment succeeded!" type="success" />
      <ToastTrigger message="Knight is reconnecting..." type="info" />
      <ToastTrigger message="Budget limit approaching" type="warning" />
      <ToastTrigger message="Connection lost" type="error" />
    </div>
  ),
}
