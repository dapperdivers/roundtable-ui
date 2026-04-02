import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KnightCard } from './KnightCard'
import type { Knight } from '../hooks/useFleet'

const mockKnight: Knight = {
  name: 'galahad',
  domain: 'security',
  status: 'online',
  ready: true,
  restarts: 0,
  age: '2h 15m',
  image: 'ghcr.io/dapperdivers/knight:latest',
  skills: 5,
  nixTools: 10,
  labels: {
    'app.kubernetes.io/name': 'knight',
    'roundtable.io/domain': 'security',
  },
  // CRD fields
  phase: 'Ready',
  model: 'claude-sonnet-4-20250514',
  runtime: 'deployment',
  suspended: false,
  tasksCompleted: 100,
  tasksFailed: 5,
  totalCost: '12.45',
  concurrency: 5,
  taskTimeout: 300,
}

describe('KnightCard', () => {
  it('renders knight name', () => {
    render(<KnightCard knight={mockKnight} />)
    expect(screen.getByText('galahad')).toBeInTheDocument()
  })

  it('renders knight domain', () => {
    render(<KnightCard knight={mockKnight} />)
    expect(screen.getByText('security')).toBeInTheDocument()
  })

  it('renders knight status', () => {
    render(<KnightCard knight={mockKnight} />)
    expect(screen.getByText('online')).toBeInTheDocument()
  })

  it('renders ready state', () => {
    render(<KnightCard knight={mockKnight} />)
    expect(screen.getByText('Ready')).toBeInTheDocument()
  })

  it('renders not ready state when knight is not ready', () => {
    const notReadyKnight = { ...mockKnight, ready: false }
    render(<KnightCard knight={notReadyKnight} />)
    expect(screen.getByText('Not Ready')).toBeInTheDocument()
  })

  it('renders restart count', () => {
    render(<KnightCard knight={mockKnight} />)
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('renders uptime age', () => {
    render(<KnightCard knight={mockKnight} />)
    expect(screen.getByText('2h 15m uptime')).toBeInTheDocument()
  })

  it('displays correct emoji for galahad', () => {
    render(<KnightCard knight={mockKnight} />)
    expect(screen.getByText('🛡️')).toBeInTheDocument()
  })

  it('displays correct title for galahad', () => {
    render(<KnightCard knight={mockKnight} />)
    expect(screen.getByText('Security')).toBeInTheDocument()
  })

  it('handles knight with multiple restarts', () => {
    const restartedKnight = { ...mockKnight, restarts: 5 }
    render(<KnightCard knight={restartedKnight} />)
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('handles offline status', () => {
    const offlineKnight = { ...mockKnight, status: 'offline' as const }
    render(<KnightCard knight={offlineKnight} />)
    expect(screen.getByText('offline')).toBeInTheDocument()
  })

  it('handles starting status', () => {
    const startingKnight = { ...mockKnight, status: 'starting' as const }
    render(<KnightCard knight={startingKnight} />)
    expect(screen.getByText('starting')).toBeInTheDocument()
  })

  it('calls onClick when card is clicked', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()
    
    render(<KnightCard knight={mockKnight} onClick={handleClick} />)
    
    await user.click(screen.getByText('galahad'))
    
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('renders different knight configurations correctly', () => {
    const kayKnight: Knight = {
      ...mockKnight,
      name: 'kay',
      domain: 'research',
    }
    
    render(<KnightCard knight={kayKnight} />)
    
    expect(screen.getByText('kay')).toBeInTheDocument()
    expect(screen.getByText('Research')).toBeInTheDocument()
    expect(screen.getByText('📡')).toBeInTheDocument()
  })

  it('handles unknown knight with default config', () => {
    const unknownKnight: Knight = {
      ...mockKnight,
      name: 'unknown-knight',
      domain: 'unknown',
    }
    
    render(<KnightCard knight={unknownKnight} />)
    
    // Knight name appears in the heading
    expect(screen.getAllByText('unknown-knight').length).toBeGreaterThan(0)
    expect(screen.getByText('🤖')).toBeInTheDocument()
  })

  it('shows activity when busy', () => {
    render(
      <KnightCard
        knight={mockKnight}
        activity={{ recent: 0, lastActive: null, busy: true }}
      />
    )
    
    expect(screen.getByText('Working...')).toBeInTheDocument()
  })

  it('shows recent task count', () => {
    render(
      <KnightCard
        knight={mockKnight}
        activity={{ recent: 5, lastActive: null, busy: false }}
      />
    )
    
    expect(screen.getByText('5 tasks recently')).toBeInTheDocument()
  })

  it('shows idle status when no activity', () => {
    render(
      <KnightCard
        knight={mockKnight}
        activity={{ recent: 0, lastActive: null, busy: false }}
      />
    )
    
    expect(screen.getByText('Idle')).toBeInTheDocument()
  })

  it('shows last active time', () => {
    const lastActive = new Date(Date.now() - 5 * 60 * 1000).toISOString() // 5 minutes ago
    
    render(
      <KnightCard
        knight={mockKnight}
        activity={{ recent: 0, lastActive, busy: false }}
      />
    )
    
    expect(screen.getByText(/Last active 5m ago/)).toBeInTheDocument()
  })

  it('renders sparkline when activity data is provided', () => {
    const { container } = render(
      <KnightCard
        knight={mockKnight}
        activity={{ 
          recent: 3, 
          lastActive: null, 
          busy: false,
          sparkline: [0.2, 0.5, 0.8, 0.6, 0.9]
        }}
      />
    )
    
    // Check for sparkline bars
    const sparkline = container.querySelector('.flex.items-end.gap-0\\.5')
    expect(sparkline).toBeInTheDocument()
  })

  it('has correct status indicator colors for online', () => {
    const { container } = render(<KnightCard knight={mockKnight} />)
    const statusIndicator = container.querySelector('.bg-green-500')
    expect(statusIndicator).toBeInTheDocument()
  })

  it('has correct status indicator colors for offline', () => {
    const offlineKnight = { ...mockKnight, status: 'offline' as const }
    const { container } = render(<KnightCard knight={offlineKnight} />)
    const statusIndicator = container.querySelector('.bg-red-500')
    expect(statusIndicator).toBeInTheDocument()
  })

  it('has correct status indicator colors for starting', () => {
    const startingKnight = { ...mockKnight, status: 'starting' as const }
    const { container } = render(<KnightCard knight={startingKnight} />)
    const statusIndicator = container.querySelector('.bg-yellow-500')
    expect(statusIndicator).toBeInTheDocument()
  })

  it('displays inspect arrow', () => {
    render(<KnightCard knight={mockKnight} />)
    expect(screen.getByText('inspect →')).toBeInTheDocument()
  })

  // New CRD parity tests
  it('renders phase badge when phase is provided', () => {
    render(<KnightCard knight={mockKnight} />)
    expect(screen.getByText('Ready')).toBeInTheDocument()
  })

  it('renders Degraded phase with yellow styling', () => {
    const degradedKnight = { ...mockKnight, phase: 'Degraded' }
    const { container } = render(<KnightCard knight={degradedKnight} />)
    expect(screen.getByText('Degraded')).toBeInTheDocument()
    const badge = container.querySelector('.bg-yellow-500\\/20')
    expect(badge).toBeInTheDocument()
  })

  it('renders Suspended phase badge', () => {
    const suspendedKnight = { ...mockKnight, phase: 'Suspended' }
    render(<KnightCard knight={suspendedKnight} />)
    expect(screen.getByText('Suspended')).toBeInTheDocument()
  })

  it('shows suspended overlay when knight is suspended', () => {
    const suspendedKnight = { ...mockKnight, suspended: true }
    render(<KnightCard knight={suspendedKnight} />)
    expect(screen.getByText('SUSPENDED')).toBeInTheDocument()
  })

  it('does not show suspended overlay when knight is not suspended', () => {
    render(<KnightCard knight={mockKnight} />)
    expect(screen.queryByText('SUSPENDED')).not.toBeInTheDocument()
  })

  it('renders runtime badge for deployment', () => {
    render(<KnightCard knight={mockKnight} />)
    expect(screen.getByText('deployment')).toBeInTheDocument()
  })

  it('renders runtime badge for sandbox with purple styling', () => {
    const sandboxKnight = { ...mockKnight, runtime: 'sandbox' }
    const { container } = render(<KnightCard knight={sandboxKnight} />)
    expect(screen.getByText('sandbox')).toBeInTheDocument()
    const badge = container.querySelector('.bg-purple-500\\/20')
    expect(badge).toBeInTheDocument()
  })

  it('renders model short name', () => {
    render(<KnightCard knight={mockKnight} />)
    // Model short name extraction: "claude-sonnet-4-20250514" -> "sonnet-4"
    expect(screen.getByText(/sonnet-4/)).toBeInTheDocument()
  })

  it('displays performance metrics when tasks completed/failed are provided', () => {
    render(<KnightCard knight={mockKnight} />)
    expect(screen.getByText('100')).toBeInTheDocument() // tasksCompleted
  })

  it('calculates and displays success rate', () => {
    const knight = { ...mockKnight, tasksCompleted: 95, tasksFailed: 5 }
    render(<KnightCard knight={knight} />)
    // Success rate: 95/(95+5) = 95%
    expect(screen.getByText(/95%/)).toBeInTheDocument()
  })

  it('displays total cost when provided', () => {
    render(<KnightCard knight={mockKnight} />)
    expect(screen.getByText(/\$12\.45/)).toBeInTheDocument()
  })

  it('handles knight without optional CRD fields', () => {
    const minimalKnight: Knight = {
      name: 'minimal',
      domain: 'general',
      status: 'online',
      ready: true,
      restarts: 0,
      age: '1h',
      image: 'knight:latest',
      skills: 0,
      nixTools: 0,
      labels: {},
    }
    
    render(<KnightCard knight={minimalKnight} />)
    expect(screen.getByText('minimal')).toBeInTheDocument()
    expect(screen.queryByText('SUSPENDED')).not.toBeInTheDocument()
  })
})
