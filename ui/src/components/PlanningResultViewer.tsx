import { useState } from 'react'
import { Brain, ChevronDown, ChevronUp } from 'lucide-react'
import type { PlanningResult } from '../hooks/useMissions'

interface PlanningResultViewerProps {
  result: PlanningResult
}

export function PlanningResultViewer({ result }: PlanningResultViewerProps) {
  const [showPlanOutput, setShowPlanOutput] = useState(false)

  return (
    <div className="bg-roundtable-navy/50 border border-indigo-500/30 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <Brain className="w-4 h-4 text-indigo-400" />
        <span className="text-xs font-medium text-indigo-400">Planning Complete</span>
      </div>

      {/* Resource counts */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        <div className="bg-roundtable-navy rounded p-2">
          <div className="text-xs text-gray-500">Chains</div>
          <div className="text-sm font-bold text-white">
            {result.chainsGenerated}
          </div>
        </div>
        <div className="bg-roundtable-navy rounded p-2">
          <div className="text-xs text-gray-500">Knights</div>
          <div className="text-sm font-bold text-white">
            {result.knightsGenerated}
          </div>
        </div>
        <div className="bg-roundtable-navy rounded p-2">
          <div className="text-xs text-gray-500">Skills</div>
          <div className="text-sm font-bold text-white">
            {result.skillsGenerated}
          </div>
        </div>
      </div>

      {/* Reasoning */}
      {result.reasoning && (
        <div className="bg-roundtable-navy rounded p-2 mb-2">
          <div className="text-xs text-gray-400 mb-1">Planner Reasoning:</div>
          <p className="text-xs text-gray-300">
            {result.reasoning}
          </p>
        </div>
      )}

      {/* Error */}
      {result.error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded p-2 mb-2">
          <div className="text-xs text-red-400">
            Planning Error: {result.error}
          </div>
        </div>
      )}

      {/* View Plan Output */}
      {result.rawOutput && (
        <div>
          <button
            onClick={(e) => { e.stopPropagation(); setShowPlanOutput(!showPlanOutput) }}
            className="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            {showPlanOutput ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
            {showPlanOutput ? 'Hide' : 'View'} Generated Plan (JSON)
          </button>
          {showPlanOutput && (
            <pre className="mt-2 text-xs text-gray-300 whitespace-pre-wrap max-h-64 overflow-auto bg-roundtable-navy rounded p-2 border border-indigo-500/30">
              {(() => {
                try {
                  return JSON.stringify(JSON.parse(result.rawOutput), null, 2)
                } catch {
                  return result.rawOutput
                }
              })()}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
