import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { X } from 'lucide-react'

type ToastType = 'success' | 'info' | 'warning' | 'error'

interface Toast {
  id: number
  message: string
  type: ToastType
  dismissing: boolean
}

interface ToastContextValue {
  addToast: (message: string, type: ToastType) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const MAX_TOASTS = 5

const typeStyles: Record<ToastType, string> = {
  success: 'border-green-500/40 bg-green-900/30',
  info: 'border-blue-500/40 bg-blue-900/30',
  warning: 'border-yellow-500/40 bg-yellow-900/30',
  error: 'border-red-500/40 bg-red-900/30',
}

const typeTextColors: Record<ToastType, string> = {
  success: 'text-green-300',
  info: 'text-blue-300',
  warning: 'text-yellow-300',
  error: 'text-red-300',
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, dismissing: true } : t))
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 300)
  }, [])

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = nextId.current++
    setToasts(prev => {
      const next = [...prev, { id, message, type, dismissing: false }]
      return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next
    })
    setTimeout(() => dismiss(id), 5000)
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col-reverse gap-2 pointer-events-none">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true))
  }, [])

  const animClass = toast.dismissing
    ? 'translate-x-full opacity-0'
    : mounted
      ? 'translate-x-0 opacity-100'
      : 'translate-y-4 opacity-0'

  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm shadow-lg transition-all duration-300 max-w-sm ${typeStyles[toast.type]} ${animClass}`}
    >
      <span className={`text-sm flex-1 ${typeTextColors[toast.type]}`}>{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
