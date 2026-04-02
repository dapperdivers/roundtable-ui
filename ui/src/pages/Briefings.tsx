import { authFetch } from '../lib/auth'
import { useState, useEffect } from 'react'
import { BookOpen, Calendar, FileText, ChevronLeft, ChevronRight, Loader2, Clock } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

// Helper to format date in human-friendly format
function formatDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  } catch {
    return dateStr
  }
}

// Helper to calculate reading time (assuming ~200 words per minute)
function calculateReadingTime(text: string): string {
  const words = text.trim().split(/\s+/).length
  const minutes = Math.ceil(words / 200)
  return `${minutes} min read`
}

// Helper to count words
function countWords(text: string): number {
  return text.trim().split(/\s+/).length
}

// Helper to navigate to next/previous day
function navigateDay(currentDate: string, direction: 'prev' | 'next'): string {
  const [year, month, day] = currentDate.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + (direction === 'next' ? 1 : -1))
  
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function BriefingsPage() {
  const [briefings, setBriefings] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [contentLoading, setContentLoading] = useState(false)
  const [contentError, setContentError] = useState(false)

  useEffect(() => {
    authFetch('/api/briefings')
      .then((r) => r.json())
      .then((data) => {
        // Sort newest first
        const sorted = data.sort().reverse()
        setBriefings(sorted)
        setLoading(false)
        
        // Auto-select the most recent briefing
        if (sorted.length > 0) {
          setSelected(sorted[0])
        }
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (selected) {
      setContentLoading(true)
      setContentError(false)
      setContent('')
      
      const date = selected.replace('.md', '')
      // FIX: Use authFetch instead of plain fetch
      authFetch(`/api/briefings/${date}`)
        .then((r) => {
          if (!r.ok) {
            throw new Error('Not found')
          }
          return r.text()
        })
        .then((text) => {
          setContent(text)
          setContentLoading(false)
        })
        .catch(() => {
          setContentError(true)
          setContentLoading(false)
        })
    }
  }, [selected])

  const handleNavigateDay = (direction: 'prev' | 'next') => {
    if (!selected) return
    const currentDate = selected.replace('.md', '')
    const newDate = navigateDay(currentDate, direction)
    const newFileName = `${newDate}.md`
    setSelected(newFileName)
  }

  const selectedDate = selected ? selected.replace('.md', '') : ''
  const wordCount = content ? countWords(content) : 0
  const readingTime = content ? calculateReadingTime(content) : ''

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
            {!loading && briefings.length === 0 && (
              <p className="text-gray-500 text-xs">No briefings yet</p>
            )}
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
          {/* Empty state when no briefings exist */}
          {!loading && briefings.length === 0 ? (
            <div className="text-center py-20">
              <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-600" />
              <p className="text-gray-400 text-lg mb-2">No briefings yet</p>
              <p className="text-gray-500 text-sm max-w-md mx-auto">
                Configure a morning chain to generate daily briefings.
              </p>
            </div>
          ) : !selected ? (
            <div className="text-center py-20 text-gray-500">
              <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>Select a chronicle from the archive</p>
              <p className="text-xs mt-2">{briefings.length} briefings available</p>
            </div>
          ) : (
            <div>
              {/* Date navigation */}
              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={() => handleNavigateDay('prev')}
                  className="p-2 rounded-lg hover:bg-roundtable-steel/50 text-gray-400 hover:text-white transition-colors"
                  title="Previous day"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                
                <div className="flex items-center gap-3 flex-1">
                  <Calendar className="w-5 h-5 text-roundtable-gold" />
                  <h2 className="text-lg font-semibold text-white">
                    {formatDate(selectedDate)}
                  </h2>
                </div>
                
                <button
                  onClick={() => handleNavigateDay('next')}
                  className="p-2 rounded-lg hover:bg-roundtable-steel/50 text-gray-400 hover:text-white transition-colors"
                  title="Next day"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Metadata bar */}
              {!contentLoading && !contentError && content && (
                <div className="flex items-center gap-4 mb-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    {wordCount.toLocaleString()} words
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {readingTime}
                  </span>
                </div>
              )}

              {/* Content area */}
              <div className="bg-roundtable-slate border border-roundtable-steel rounded-xl p-6 min-h-[400px]">
                {contentLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 text-roundtable-gold animate-spin" />
                  </div>
                ) : contentError ? (
                  <div className="text-center py-20 text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>No briefing available for this date</p>
                    <p className="text-xs mt-2">Try selecting another date from the archive</p>
                  </div>
                ) : (
                  <div className="prose prose-invert prose-sm max-w-none 
                    prose-headings:text-white prose-headings:font-semibold
                    prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg
                    prose-p:text-gray-300 prose-p:leading-relaxed
                    prose-a:text-roundtable-gold prose-a:no-underline hover:prose-a:underline
                    prose-strong:text-white prose-strong:font-semibold
                    prose-code:text-roundtable-gold prose-code:bg-roundtable-steel/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none
                    prose-pre:bg-roundtable-steel/30 prose-pre:border prose-pre:border-roundtable-steel
                    prose-ul:text-gray-300 prose-ol:text-gray-300
                    prose-li:text-gray-300 prose-li:marker:text-roundtable-gold
                    prose-blockquote:border-l-roundtable-gold prose-blockquote:text-gray-400
                    prose-hr:border-roundtable-steel">
                    <ReactMarkdown>{content}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
