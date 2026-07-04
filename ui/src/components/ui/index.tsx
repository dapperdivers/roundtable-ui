/**
 * Shared UI primitives. Every page previously hand-rolled these idioms
 * (spinners, error banners, empty states, headers, stat cards, badges,
 * collapsibles, overlays, progress bars) with drifting styles — this is
 * the one copy.
 */
import { useState, type ReactNode, type ComponentType } from 'react'
import { RefreshCw, ChevronDown, ChevronUp, X } from 'lucide-react'
import { phaseColor } from '../../lib/status'

/* ------------------------------------------------------------------ */
/* Feedback                                                            */
/* ------------------------------------------------------------------ */

/** Gold ring spinner. */
export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const dims = size === 'sm' ? 'w-5 h-5' : 'w-8 h-8'
  return (
    <div className={`animate-spin ${dims} border-2 border-roundtable-gold border-t-transparent rounded-full`} />
  )
}

/** Red error banner. */
export function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
      {children}
    </div>
  )
}

/** Centered icon + message for "nothing here yet" sections. */
export function EmptyState({ icon: Icon, title, sub }: {
  icon?: ComponentType<{ className?: string }>
  title: string
  sub?: string
}) {
  return (
    <div className="text-center py-12">
      {Icon && <Icon className="w-12 h-12 text-gray-600 mx-auto mb-3" />}
      <p className="text-gray-500">{title}</p>
      {sub && <p className="text-gray-600 text-sm mt-1">{sub}</p>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Page chrome                                                         */
/* ------------------------------------------------------------------ */

/** Page title row: gold icon + h1 (+ optional subtitle) left, actions right. */
export function PageHeader({ icon: Icon, title, subtitle, children }: {
  icon: ComponentType<{ className?: string }>
  title: string
  subtitle?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Icon className="w-8 h-8 text-roundtable-gold" />
          {title}
        </h1>
        {subtitle && <p className="text-gray-400 mt-2">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </div>
  )
}

export function RefreshButton({ onClick, loading = false, disabled = false }: {
  onClick: () => void
  loading?: boolean
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 px-3 py-1.5 text-sm bg-roundtable-steel/50 hover:bg-roundtable-steel text-gray-300 rounded-lg transition-colors disabled:opacity-50"
    >
      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
      Refresh
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Data display                                                        */
/* ------------------------------------------------------------------ */

/** "Label + big colored value" tile used on every overview page. */
export function StatCard({ label, value, total, color = 'text-white', icon, detail }: {
  label: string
  value: string | number
  total?: number
  color?: string
  icon?: ReactNode
  detail?: string
}) {
  return (
    <div className="bg-roundtable-slate border border-roundtable-steel rounded-xl p-4">
      <div className="flex items-center justify-between">
        <p className="text-gray-400 text-xs">{label}</p>
        {icon && <span className={color}>{icon}</span>}
      </div>
      <p className={`text-2xl font-bold mt-1 ${color}`}>
        {value}
        {total !== undefined && <span className="text-gray-500 text-lg">/{total}</span>}
      </p>
      {detail && <p className="text-xs text-gray-500 mt-0.5">{detail}</p>}
    </div>
  )
}

/** Phase pill colored via the shared lib/status map. */
export function PhaseBadge({ phase }: { phase: string }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${phaseColor(phase)}`}>
      {phase}
    </span>
  )
}

/** Horizontal meter: track + colored fill, percent 0–100. */
export function ProgressBar({ percent, fillClass = 'bg-roundtable-gold/40', heightClass = 'h-2' }: {
  percent: number
  fillClass?: string
  heightClass?: string
}) {
  return (
    <div className={`${heightClass} bg-roundtable-navy rounded-full overflow-hidden`}>
      <div
        className={`${heightClass} ${fillClass} rounded-full transition-all`}
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Disclosure & overlays                                               */
/* ------------------------------------------------------------------ */

/** Chevron-toggled section. Uncontrolled; pass defaultOpen to start open. */
export function Collapsible({ title, defaultOpen = false, children }: {
  title: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left text-sm text-gray-300 hover:text-white transition-colors"
      >
        <span className="flex items-center gap-2">{title}</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  )
}

/** Centered modal with dimmed backdrop. Closes only via the X button —
 *  backdrop clicks are ignored so stray clicks can't discard form state. */
export function Modal({ onClose, title, icon, children }: {
  onClose: () => void
  title: ReactNode
  icon?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-roundtable-slate border border-roundtable-steel rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-roundtable-steel">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            {icon}
            {title}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Right-side slide-over panel with dimmed backdrop. */
export function Drawer({ onClose, children, widthClass = 'w-full max-w-xl' }: {
  onClose: () => void
  children: ReactNode
  widthClass?: string
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className={`fixed right-0 top-0 h-full ${widthClass} bg-roundtable-slate border-l border-roundtable-steel z-50 overflow-y-auto`}>
        {children}
      </div>
    </>
  )
}
