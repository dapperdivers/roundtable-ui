import { useState } from 'react'
import { Swords, KeyRound, AlertCircle } from 'lucide-react'
import { setApiKey } from '../lib/auth'

interface LoginPageProps {
  onLogin: () => void
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [apiKey, setApiKeyValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!apiKey.trim()) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      })

      if (res.ok) {
        setApiKey(apiKey.trim())
        onLogin()
      } else {
        const data = await res.json().catch(() => ({ error: 'Login failed' }))
        setError(data.error || 'Invalid API key')
      }
    } catch {
      setError('Connection failed. Is the API running?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-roundtable-navy flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Swords className="w-16 h-16 text-roundtable-gold mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-roundtable-gold">⚔️ The Round Table</h1>
          <p className="text-gray-400 mt-2">Enter your API key to proceed</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-roundtable-slate border border-roundtable-steel rounded-xl p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="apiKey" className="block text-sm font-medium text-gray-300 mb-2">
              <KeyRound className="w-4 h-4 inline mr-1" />
              API Key
            </label>
            <input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKeyValue(e.target.value)}
              placeholder="Enter your DASHBOARD_API_KEY"
              className="w-full px-4 py-3 bg-roundtable-navy border border-roundtable-steel rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-roundtable-gold/50 focus:ring-1 focus:ring-roundtable-gold/30"
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={loading || !apiKey.trim()}
            className="w-full py-3 px-4 bg-roundtable-gold/20 border border-roundtable-gold/30 text-roundtable-gold rounded-lg font-medium hover:bg-roundtable-gold/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Authenticating...' : 'Enter the Round Table'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-600 mt-4">
          Set DASHBOARD_API_KEY env var on the API to enable authentication
        </p>
      </div>
    </div>
  )
}
