import { useState, useEffect } from 'react'
import { ScrollText } from 'lucide-react'

export function BriefingsPage() {
  const [briefings, setBriefings] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/briefings')
      .then((r) => r.json())
      .then((data) => {
        setBriefings(data.sort().reverse())
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (selected) {
      const date = selected.replace('.md', '')
      fetch(`/api/briefings/${date}`)
        .then((r) => r.text())
        .then(setContent)
    }
  }, [selected])

  return (
    <div>
      <h1 className="text-3xl font-bold text-white flex items-center gap-3 mb-8">
        <ScrollText className="w-8 h-8 text-roundtable-gold" />
        Daily Briefings
      </h1>

      <div className="flex gap-6">
        {/* Briefing list */}
        <div className="w-64 shrink-0">
          <div className="bg-roundtable-slate border border-roundtable-steel rounded-xl p-4">
            <h2 className="text-sm font-medium text-gray-400 mb-3">Archives</h2>
            {loading && <p className="text-gray-500 text-sm">Loading...</p>}
            <div className="space-y-1">
              {briefings.map((b) => (
                <button
                  key={b}
                  onClick={() => setSelected(b)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    selected === b
                      ? 'bg-roundtable-gold/10 text-roundtable-gold'
                      : 'text-gray-400 hover:text-white hover:bg-roundtable-steel/50'
                  }`}
                >
                  📄 {b.replace('.md', '')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Briefing content */}
        <div className="flex-1">
          {!selected ? (
            <div className="text-center py-20 text-gray-500">
              Select a briefing from the archive
            </div>
          ) : (
            <div className="bg-roundtable-slate border border-roundtable-steel rounded-xl p-6">
              <pre className="text-gray-300 text-sm whitespace-pre-wrap font-sans leading-relaxed">
                {content}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
