import { useState, useMemo } from 'react'
import { Target, RefreshCw, Filter, Plus } from 'lucide-react'
import { useMissions } from '../hooks/useMissions'
import { MissionCard } from '../components/MissionCard'
import { MissionPhaseBadge } from '../components/MissionPhaseBadge'
import { MissionWizard } from './MissionWizard'

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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Target className="w-8 h-8 text-roundtable-gold" />
          Missions
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-roundtable-gold/20 border border-roundtable-gold/30 text-roundtable-gold rounded-lg hover:bg-roundtable-gold/30 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Mission
          </button>
          <button
            onClick={refresh}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-roundtable-steel/50 hover:bg-roundtable-steel text-gray-300 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-roundtable-slate border border-roundtable-steel rounded-xl p-4">
          <div className="text-2xl font-bold text-white">{stats.total}</div>
          <div className="text-sm text-gray-400">Total Missions</div>
        </div>
        <div className="bg-roundtable-slate border border-blue-500/20 rounded-xl p-4">
          <div className="text-2xl font-bold text-blue-400">{stats.active}</div>
          <div className="text-sm text-gray-400">Active</div>
        </div>
        <div className="bg-roundtable-slate border border-green-500/20 rounded-xl p-4">
          <div className="text-2xl font-bold text-green-400">{stats.succeeded}</div>
          <div className="text-sm text-gray-400">Succeeded</div>
        </div>
        <div className="bg-roundtable-slate border border-red-500/20 rounded-xl p-4">
          <div className="text-2xl font-bold text-red-400">{stats.failed}</div>
          <div className="text-sm text-gray-400">Failed</div>
        </div>
        <div className="bg-roundtable-slate border border-roundtable-gold/20 rounded-xl p-4">
          <div className="text-2xl font-bold text-roundtable-gold">${stats.totalCost.toFixed(2)}</div>
          <div className="text-sm text-gray-400">Total Cost</div>
        </div>
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
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
          <p className="text-red-400 text-sm">Failed to load missions: {error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && missions.length === 0 && (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-roundtable-gold border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading missions...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && missions.length === 0 && (
        <div className="text-center py-12">
          <Target className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500">No missions found.</p>
          <p className="text-gray-600 text-sm mt-1">Create a mission to get started.</p>
        </div>
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
