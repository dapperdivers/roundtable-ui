import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { DashboardPage } from './Dashboard'

// Mock the hooks
vi.mock('../hooks/useFleet', () => ({
  useFleet: vi.fn(() => ({
    knights: [
      {
        name: 'galahad',
        domain: 'security',
        status: 'online',
        ready: true,
        restarts: 0,
        age: '2h',
        image: 'knight:latest',
        skills: 5,
        nixTools: 10,
        labels: {},
        phase: 'Ready',
      },
      {
        name: 'lancelot',
        domain: 'frontend',
        status: 'online',
        ready: true,
        restarts: 0,
        age: '1h',
        image: 'knight:latest',
        skills: 3,
        nixTools: 5,
        labels: {},
        phase: 'Ready',
      },
    ],
    loading: false,
    error: null,
  })),
}))

vi.mock('../hooks/useWebSocket', () => ({
  useWebSocket: vi.fn(() => ({
    events: [],
    connected: true,
  })),
}))

vi.mock('../lib/auth', () => ({
  authFetch: vi.fn((url: string) => {
    if (url === '/api/chains') {
      return Promise.resolve({
        json: () => Promise.resolve([
          {
            name: 'test-chain',
            phase: 'Running',
            startTime: new Date().toISOString(),
            steps: [],
          },
        ]),
      })
    }
    if (url === '/api/fleet') {
      return Promise.resolve({
        json: () => Promise.resolve([
          { name: 'galahad' },
          { name: 'lancelot' },
        ]),
      })
    }
    return Promise.resolve({ json: () => Promise.resolve({}) })
  }),
}))

function renderDashboard(props = {}) {
  return render(
    <BrowserRouter>
      <DashboardPage {...props} />
    </BrowserRouter>
  )
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the dashboard title', () => {
    renderDashboard()
    expect(screen.getByText('Round Table Dashboard')).toBeInTheDocument()
  })

  it('displays fleet status section', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText(/Fleet Status/i)).toBeInTheDocument()
    })
  })

  it('shows online knight count', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument() // 2 knights online
    })
  })

  it('displays cost panel toggle', async () => {
    renderDashboard()
    await waitFor(() => {
      // Look for cost-related text
      const costElements = screen.queryAllByText(/cost/i)
      expect(costElements.length).toBeGreaterThan(0)
    })
  })

  it('cost panel is collapsed by default', () => {
    renderDashboard()
    // Panel should be collapsed, so detailed breakdown not visible initially
    const costPanel = screen.queryByText(/Per-Knight Breakdown/i)
    // If collapsed, this may not be in the document
    expect(costPanel).not.toBeInTheDocument()
  })

  it('cost panel is expanded when defaultCostExpanded is true', async () => {
    renderDashboard({ defaultCostExpanded: true })
    await waitFor(() => {
      expect(screen.getByText(/Session Costs/i)).toBeInTheDocument()
    })
  })

  it('toggles cost panel when clicked', async () => {
    const user = userEvent.setup()
    renderDashboard()

    // Find and click the cost panel toggle button
    const costButton = screen.getByRole('button', { name: /Session Costs/i })
    
    // Initially collapsed
    expect(screen.queryByText(/Per-Knight Breakdown/i)).not.toBeInTheDocument()
    
    // Click to expand
    await user.click(costButton)
    
    await waitFor(() => {
      expect(screen.getByText(/Per-Knight Breakdown/i)).toBeInTheDocument()
    })
    
    // Click to collapse
    await user.click(costButton)
    
    await waitFor(() => {
      expect(screen.queryByText(/Per-Knight Breakdown/i)).not.toBeInTheDocument()
    })
  })

  it('displays activity feed section', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText(/Activity Feed/i)).toBeInTheDocument()
    })
  })

  it('shows recent chains section', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText(/Recent Chains/i)).toBeInTheDocument()
    })
  })

  it('displays WebSocket connection status', async () => {
    renderDashboard()
    await waitFor(() => {
      // Connected status indicator
      const liveIndicator = screen.queryByText(/live/i)
      expect(liveIndicator).toBeInTheDocument()
    })
  })

  it('renders fleet link', () => {
    renderDashboard()
    const fleetLink = screen.getByRole('link', { name: /View Full Fleet/i })
    expect(fleetLink).toHaveAttribute('href', '/fleet')
  })

  it('renders chains link', () => {
    renderDashboard()
    const chainsLink = screen.getByRole('link', { name: /View All Chains/i })
    expect(chainsLink).toHaveAttribute('href', '/chains')
  })

  it('handles empty fleet gracefully', () => {
    const { useFleet } = require('../hooks/useFleet')
    useFleet.mockReturnValueOnce({
      knights: [],
      loading: false,
      error: null,
    })

    renderDashboard()
    expect(screen.getByText('Round Table Dashboard')).toBeInTheDocument()
  })

  it('displays time range selector', async () => {
    renderDashboard({ defaultCostExpanded: true })
    await waitFor(() => {
      expect(screen.getByText('Week')).toBeInTheDocument()
    })
  })
})
