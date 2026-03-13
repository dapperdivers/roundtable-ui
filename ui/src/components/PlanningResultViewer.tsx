import { useState } from 'react'
import { Brain, ChevronDown, ChevronRight, CheckCircle, XCircle } from 'lucide-react'
import type { PlanningResult } from '../hooks/useMissions'

interface PlanningResultViewerProps {
  result: PlanningResult
}

export function PlanningResultViewer({ result }: PlanningResultViewerProps) {
  const [showReasoning, setShowReasoning] = useState(false)
  const [showRawPlan, setShowRawPlan] = useState(false)
  
  const hasError = result.error && result.error.length > 0

  return (
    <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 mt-3">
      <div className="flex items-center gap-2 mb-3">
        <Brain className="w-4 h-4 text-indigo-400" />
        <h4 className="text-sm font-medium text-indigo-400">Planning Result</h4>
        {hasError ? (
          <XCircle className="w-4 h-4 text-red-400 ml-auto" />
        ) : (
          <CheckCircle className="w-4 h-4 text-green-400 ml-auto" />
        )}
      </div>
      
      {/* Error Display */}
      {hasError && (
        <div className="mb-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <div className="text-xs font-medium text-red-400 mb-1">Planning Failed</div>
          <div className="text-xs text-red-300">{result.error}</div>
        </div>
      )}
      
      {/* Summary Stats */}
      {!hasError && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-roundtable-navy/50 rounded-lg p-2">
            <div className="text-xs text-gray-400">Chains</div>
            <div className="text-lg font-bold text-white">{result.chainsGenerated}</div>
          </div>
          <div className="bg-roundtable-navy/50 rounded-lg p-2">
            <div className="text-xs text-gray-400">Knights</div>
            <div className="text-lg font-bold text-white">{result.knightsGenerated}</div>
          </div>
          <div className="bg-roundtable-navy/50 rounded-lg p-2">
            <div className="text-xs text-gray-400">Skills</div>
            <div className="text-lg font-bold text-white">{result.skillsGenerated}</div>
          </div>
        </div>
      )}
      
      {/* Reasoning (collapsible) */}
      {result.reasoning && (
        <div className="mb-3">
          <button
            onClick={() => setShowReasoning(!showReasoning)}
            className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            {showReasoning ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            Planner Reasoning
          </button>
          {showReasoning && (
            <div className="mt-2 p-3 bg-roundtable-navy rounded-lg text-xs text-gray-300 whitespace-pre-wrap">
              {result.reasoning}
            </div>
          )}
        </div>
      )}
      
      {/* Raw Plan JSON (collapsible) */}
      {result.rawOutput && (
        <div>
          <button
            onClick={() => setShowRawPlan(!showRawPlan)}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-300 transition-colors"
          >
            {showRawPlan ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            Raw Plan JSON
          </button>
          {showRawPlan && (
            <pre className="mt-2 p-3 bg-roundtable-navy rounded-lg text-xs text-gray-300 overflow-x-auto max-h-96 overflow-y-auto">
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
