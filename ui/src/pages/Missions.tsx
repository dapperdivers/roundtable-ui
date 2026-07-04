import { useState, useMemo } from 'react'
import { Target, Filter, Plus } from 'lucide-react'
import { useMissions } from '../hooks/useMissions'
import { MissionCard } from '../components/MissionCard'
import { MissionPhaseBadge } from '../components/MissionPhaseBadge'
import { MissionWizard } from './MissionWizard'
import { PageHeader, RefreshButton, StatCard, ErrorBanner, Spinner, EmptyState } from '../components/ui'
import { formatCost } from '../lib/format'

const PHASE_FILTERS = [
  'All',
  'Pending',
  'Provisioning',
  'Planning',
  'Assembling',
  'Briefing',
  'Active',
  'Succeeded',
  'Failed',
  'CleaningUp',
  'Expired',
]

export function MissionsPage() {
  const { missions, loading, error, refresh } = useMissions()
  const [phaseFilter, setPhaseFilter] = useState('All')
  const [roundTableFilter, setRoundTableFilter] = useState('All')
  const [showWizard, setShowWizard] = useState(false)

  // Extract unique RoundTables
  const roundTables = useMemo(() => {
    const unique = new Set(missions.map(m => m.roundTableRef))
    return ['All', ...Array.from(unique).sort()]
  }, [missions])

  // Filtered missions
  const filteredMissions = useMemo(() => {
    return missions.filter(m => {
      if (phaseFilter !== 'All' && m.phase !== phaseFilter) return false
      if (roundTableFilter !== 'All' && m.roundTableRef !== roundTableFilter) return false
      return true
    })
  }, [missions, phaseFilter, roundTableFilter])

  // Summary stats
  const stats = useMemo(() => {
    const total = missions.length
    const active = missions.filter(m => m.phase === 'Active').length
    const succeeded = missions.filter(m => m.phase === 'Succeeded').length
    const failed = missions.filter(m => m.phase === 'Failed').length
    const totalCost = missions.reduce((sum, m) => sum + (parseFloat(m.totalCost) || 0), 0)
    return { total, active, succeeded, failed, totalCost }
  }, [missions])

  return (
    <div>
      {/* Header */}
      <PageHeader icon={Target} title="Missions">
        <button
          onClick={() => setShowWizard(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-roundtable-gold/20 border border-roundtable-gold/30 text-roundtable-gold rounded-lg hover:bg-roundtable-gold/30 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Mission
        </button>
        <RefreshButton onClick={refresh} loading={loading} />
      </PageHeader>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <StatCard label="Total Missions" value={stats.total} />
        <StatCard label="Active" value={stats.active} color="text-blue-400" />
        <StatCard label="Succeeded" value={stats.succeeded} color="text-green-400" />
        <StatCard label="Failed" value={stats.failed} color="text-red-400" />
        <StatCard label="Total Cost" value={formatCost(stats.totalCost)} color="text-roundtable-gold" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-400">Filters:</span>
        </div>

        {/* Phase Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Phase:</span>
          <div className="flex flex-wrap gap-2">
            {PHASE_FILTERS.map((phase) => (
              <button
                key={phase}
                onClick={() => setPhaseFilter(phase)}
                className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
                  phaseFilter === phase
                    ? 'bg-roundtable-gold/20 border border-roundtable-gold/30 text-roundtable-gold'
                    : 'border border-roundtable-steel text-gray-400 hover:text-white hover:border-gray-500'
                }`}
              >
                {phase === 'All' ? phase : <MissionPhaseBadge phase={phase} />}
              </button>
            ))}
          </div>
        </div>

        {/* RoundTable Filter */}
        {roundTables.length > 2 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">RoundTable:</span>
            <select
              value={roundTableFilter}
              onChange={(e) => setRoundTableFilter(e.target.value)}
              className="text-xs px-2 py-1 bg-roundtable-navy border border-roundtable-steel rounded-lg text-gray-300"
            >
              {roundTables.map((rt) => (
                <option key={rt} value={rt}>
                  {rt}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Active Filters Count */}
        {(phaseFilter !== 'All' || roundTableFilter !== 'All') && (
          <div className="ml-auto">
            <button
              onClick={() => {
                setPhaseFilter('All')
                setRoundTableFilter('All')
              }}
              className="text-xs text-gray-400 hover:text-roundtable-gold transition-colors"
            >
              Clear filters ({filteredMissions.length} shown)
            </button>
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-6">
          <ErrorBanner>Failed to load missions: {error}</ErrorBanner>
        </div>
      )}

      {/* Loading State */}
      {loading && missions.length === 0 && (
        <div className="text-center py-12">
          <div className="flex justify-center mb-3">
            <Spinner />
          </div>
          <p className="text-gray-500 text-sm">Loading missions...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && missions.length === 0 && (
        <EmptyState icon={Target} title="No missions found." sub="Create a mission to get started." />
      )}

      {/* Filtered Empty State */}
      {!loading && missions.length > 0 && filteredMissions.length === 0 && (
        <div className="text-center py-12">
          <Filter className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500">No missions match your filters.</p>
          <button
            onClick={() => {
              setPhaseFilter('All')
              setRoundTableFilter('All')
            }}
            className="text-sm text-roundtable-gold hover:text-yellow-300 mt-2"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Mission Grid */}
      {filteredMissions.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredMissions.map((mission) => (
            <MissionCard key={mission.name} mission={mission} />
          ))}
        </div>
      )}

      {/* Mission Creation Wizard */}
      {showWizard && (
        <MissionWizard
          onClose={() => setShowWizard(false)}
          onCreated={() => { setShowWizard(false); refresh() }}
        />
      )}
    </div>
  )
}
