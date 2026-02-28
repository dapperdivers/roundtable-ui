import { useState, useEffect } from 'react'
import { BookOpen, Calendar, FileText } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

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
        <BookOpen className="w-8 h-8 text-roundtable-gold" />
        Chronicles
      </h1>

      <div className="flex gap-6">
        {/* Archive sidebar */}
        <div className="w-64 shrink-0">
          <div className="bg-roundtable-slate border border-roundtable-steel rounded-xl p-4">
            <h2 className="text-sm font-medium text-gray-400 mb-3">Archives</h2>
            {loading && <p className="text-gray-500 text-sm">Loading...</p>}
            <div className="space-y-1 max-h-[70vh] overflow-y-auto">
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
                  📜 {b.replace('.md', '')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Briefing content */}
        <div className="flex-1">
          {!selected ? (
            <div className="text-center py-20 text-gray-500">
              <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>Select a chronicle from the archive</p>
              <p className="text-xs mt-2">{briefings.length} briefings available</p>
            </div>
          ) : (
            <div>
              {/* Briefing header */}
              <div className="flex items-center gap-3 mb-4">
                <Calendar className="w-5 h-5 text-roundtable-gold" />
                <h2 className="text-lg font-semibold text-white">{selected.replace('.md', '')}</h2>
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  {content.length.toLocaleString()} chars
                </span>
              </div>
              <div className="bg-roundtable-slate border border-roundtable-steel rounded-xl p-6 prose prose-invert prose-sm max-w-none">
                <ReactMarkdown>{content}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
