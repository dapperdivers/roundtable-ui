import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastProvider, useToast } from './Toast'

// Helper component to test the toast hook
function ToastTrigger({ message, type }: { message: string; type: 'success' | 'info' | 'warning' | 'error' }) {
  const { addToast } = useToast()
  return <button onClick={() => addToast(message, type)}>Show Toast</button>
}

describe('Toast', () => {
  it('throws error when useToast is used outside provider', () => {
    // Suppress console.error for this test
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    expect(() => {
      render(<ToastTrigger message="test" type="info" />)
    }).toThrow('useToast must be used within ToastProvider')
    
    consoleError.mockRestore()
  })

  it('renders success toast with correct styling', async () => {
    const user = userEvent.setup()
    
    render(
      <ToastProvider>
        <ToastTrigger message="Success message" type="success" />
      </ToastProvider>
    )

    await user.click(screen.getByText('Show Toast'))

    expect(screen.getByText('Success message')).toBeInTheDocument()
    const toast = screen.getByText('Success message').closest('div')
    expect(toast).toHaveClass('border-green-500/40', 'bg-green-900/30')
  })

  it('renders info toast with correct styling', async () => {
    const user = userEvent.setup()
    
    render(
      <ToastProvider>
        <ToastTrigger message="Info message" type="info" />
      </ToastProvider>
    )

    await user.click(screen.getByText('Show Toast'))

    expect(screen.getByText('Info message')).toBeInTheDocument()
    const toast = screen.getByText('Info message').closest('div')
    expect(toast).toHaveClass('border-blue-500/40', 'bg-blue-900/30')
  })

  it('renders warning toast with correct styling', async () => {
    const user = userEvent.setup()
    
    render(
      <ToastProvider>
        <ToastTrigger message="Warning message" type="warning" />
      </ToastProvider>
    )

    await user.click(screen.getByText('Show Toast'))

    expect(screen.getByText('Warning message')).toBeInTheDocument()
    const toast = screen.getByText('Warning message').closest('div')
    expect(toast).toHaveClass('border-yellow-500/40', 'bg-yellow-900/30')
  })

  it('renders error toast with correct styling', async () => {
    const user = userEvent.setup()
    
    render(
      <ToastProvider>
        <ToastTrigger message="Error message" type="error" />
      </ToastProvider>
    )

    await user.click(screen.getByText('Show Toast'))

    expect(screen.getByText('Error message')).toBeInTheDocument()
    const toast = screen.getByText('Error message').closest('div')
    expect(toast).toHaveClass('border-red-500/40', 'bg-red-900/30')
  })

  it('shows multiple toasts at the same time', async () => {
    const user = userEvent.setup()
    
    function MultipleToastTriggers() {
      const { addToast } = useToast()
      return (
        <div>
          <button onClick={() => addToast('First toast', 'success')}>Toast 1</button>
          <button onClick={() => addToast('Second toast', 'error')}>Toast 2</button>
        </div>
      )
    }

    render(
      <ToastProvider>
        <MultipleToastTriggers />
      </ToastProvider>
    )

    await user.click(screen.getByText('Toast 1'))
    await user.click(screen.getByText('Toast 2'))

    expect(screen.getByText('First toast')).toBeInTheDocument()
    expect(screen.getByText('Second toast')).toBeInTheDocument()
  })
})
