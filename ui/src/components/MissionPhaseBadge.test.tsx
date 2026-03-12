import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MissionPhaseBadge } from './MissionPhaseBadge'

describe('MissionPhaseBadge', () => {
  it('renders the phase text', () => {
    render(<MissionPhaseBadge phase="Active" />)
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('renders Pending phase with correct styles', () => {
    const { container } = render(<MissionPhaseBadge phase="Pending" />)
    const badge = container.querySelector('span')
    expect(badge).toHaveClass('bg-gray-500/20', 'text-gray-400', 'border-gray-500/30')
  })

  it('renders Provisioning phase with correct styles', () => {
    const { container } = render(<MissionPhaseBadge phase="Provisioning" />)
    const badge = container.querySelector('span')
    expect(badge).toHaveClass('bg-blue-500/20', 'text-blue-400', 'border-blue-500/30')
  })

  it('renders Assembling phase with correct styles', () => {
    const { container } = render(<MissionPhaseBadge phase="Assembling" />)
    const badge = container.querySelector('span')
    expect(badge).toHaveClass('bg-cyan-500/20', 'text-cyan-400', 'border-cyan-500/30')
  })

  it('renders Briefing phase with correct styles', () => {
    const { container } = render(<MissionPhaseBadge phase="Briefing" />)
    const badge = container.querySelector('span')
    expect(badge).toHaveClass('bg-purple-500/20', 'text-purple-400', 'border-purple-500/30')
  })

  it('renders Active phase with correct styles', () => {
    const { container } = render(<MissionPhaseBadge phase="Active" />)
    const badge = container.querySelector('span')
    expect(badge).toHaveClass('bg-blue-500/20', 'text-blue-400', 'border-blue-500/30')
  })

  it('renders Succeeded phase with correct styles', () => {
    const { container } = render(<MissionPhaseBadge phase="Succeeded" />)
    const badge = container.querySelector('span')
    expect(badge).toHaveClass('bg-green-500/20', 'text-green-400', 'border-green-500/30')
  })

  it('renders Failed phase with correct styles', () => {
    const { container } = render(<MissionPhaseBadge phase="Failed" />)
    const badge = container.querySelector('span')
    expect(badge).toHaveClass('bg-red-500/20', 'text-red-400', 'border-red-500/30')
  })

  it('renders CleaningUp phase with correct styles', () => {
    const { container } = render(<MissionPhaseBadge phase="CleaningUp" />)
    const badge = container.querySelector('span')
    expect(badge).toHaveClass('bg-orange-500/20', 'text-orange-400', 'border-orange-500/30')
  })

  it('renders Expired phase with correct styles', () => {
    const { container } = render(<MissionPhaseBadge phase="Expired" />)
    const badge = container.querySelector('span')
    expect(badge).toHaveClass('bg-gray-500/20', 'text-gray-500', 'border-gray-500/30')
  })

  it('falls back to Pending styles for unknown phase', () => {
    const { container } = render(<MissionPhaseBadge phase="UnknownPhase" />)
    const badge = container.querySelector('span')
    expect(badge).toHaveClass('bg-gray-500/20', 'text-gray-400', 'border-gray-500/30')
    expect(screen.getByText('UnknownPhase')).toBeInTheDocument()
  })

  it('has consistent badge structure with correct classes', () => {
    const { container } = render(<MissionPhaseBadge phase="Active" />)
    const badge = container.querySelector('span')
    expect(badge).toHaveClass('text-xs', 'font-medium', 'px-2', 'py-0.5', 'rounded-full', 'border')
  })
})
