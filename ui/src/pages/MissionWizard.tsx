import { useState } from 'react'
import { Target, Plus, X, ArrowLeft, Rocket } from 'lucide-react'
import { authFetch } from '../lib/auth'

interface MissionForm {
  name: string
  objective: string
  roundTableRef: string
  costBudgetUSD: string
  ttl: number
  timeout: number
  knights: { name: string; role: string }[]
}

const INITIAL_FORM: MissionForm = {
  name: '',
  objective: '',
  roundTableRef: '',
  costBudgetUSD: '1.00',
  ttl: 3600,
  timeout: 300,
  knights: [{ name: '', role: '' }],
}

interface MissionWizardProps {
  onClose: () => void
  onCreated: () => void
}

export function MissionWizard({ onClose, onCreated }: MissionWizardProps) {
  const [form, setForm] = useState<MissionForm>({ ...INITIAL_FORM })
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateField = <K extends keyof MissionForm>(key: K, value: MissionForm[K]) => {
    setForm(f => ({ ...f, [key]: value }))
  }

  const addKnight = () => {
    setForm(f => ({ ...f, knights: [...f.knights, { name: '', role: '' }] }))
  }

  const removeKnight = (idx: number) => {
    setForm(f => ({ ...f, knights: f.knights.filter((_, i) => i !== idx) }))
  }

  const updateKnight = (idx: number, field: 'name' | 'role', value: string) => {
    setForm(f => ({
      ...f,
      knights: f.knights.map((k, i) => i === idx ? { ...k, [field]: value } : k),
    }))
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const body = {
        name: form.name,
        objective: form.objective,
        roundTableRef: form.roundTableRef,
        costBudgetUSD: form.costBudgetUSD,
        ttl: form.ttl,
        timeout: form.timeout,
        knights: form.knights.filter(k => k.name.trim()),
      }
      const res = await authFetch('/api/missions', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.text()
        throw new Error(data)
      }
      onCreated()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create mission')
    } finally {
      setSubmitting(false)
    }
  }

  const steps = [
    { title: 'Basics', valid: form.name.trim() && form.objective.trim() },
    { title: 'Knights', valid: form.knights.some(k => k.name.trim()) },
    { title: 'Review', valid: true },
  ]

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-roundtable-slate border border-roundtable-steel rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-roundtable-steel">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-roundtable-gold" />
            Create Mission
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2 px-6 pt-4">
          {steps.map((s, i) => (
            <button
              key={s.title}
              onClick={() => setStep(i)}
              className={`flex-1 text-center text-xs py-2 rounded-lg transition-colors ${
                i === step
                  ? 'bg-roundtable-gold/20 text-roundtable-gold border border-roundtable-gold/30'
                  : i < step
                  ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                  : 'bg-roundtable-steel/30 text-gray-500 border border-roundtable-steel'
              }`}
            >
              {s.title}
            </button>
          ))}
        </div>

        {/* Step content */}
        <div className="p-6 space-y-4">
          {step === 0 && (
            <>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Mission Name</label>
                <input
                  value={form.name}
                  onChange={e => updateField('name', e.target.value)}
                  placeholder="e.g. code-review-sprint"
                  className="w-full px-3 py-2 bg-roundtable-navy border border-roundtable-steel rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-roundtable-gold/50"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Objective</label>
                <textarea
                  value={form.objective}
                  onChange={e => updateField('objective', e.target.value)}
                  placeholder="Describe the mission objective..."
                  rows={3}
                  className="w-full px-3 py-2 bg-roundtable-navy border border-roundtable-steel rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-roundtable-gold/50 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">RoundTable Reference</label>
                <input
                  value={form.roundTableRef}
                  onChange={e => updateField('roundTableRef', e.target.value)}
                  placeholder="e.g. fleet-a"
                  className="w-full px-3 py-2 bg-roundtable-navy border border-roundtable-steel rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-roundtable-gold/50"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Cost Budget (USD)</label>
                  <input
                    value={form.costBudgetUSD}
                    onChange={e => updateField('costBudgetUSD', e.target.value)}
                    className="w-full px-3 py-2 bg-roundtable-navy border border-roundtable-steel rounded-lg text-white focus:outline-none focus:border-roundtable-gold/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">TTL (seconds)</label>
                  <input
                    type="number"
                    value={form.ttl}
                    onChange={e => updateField('ttl', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-roundtable-navy border border-roundtable-steel rounded-lg text-white focus:outline-none focus:border-roundtable-gold/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Timeout (seconds)</label>
                  <input
                    type="number"
                    value={form.timeout}
                    onChange={e => updateField('timeout', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-roundtable-navy border border-roundtable-steel rounded-lg text-white focus:outline-none focus:border-roundtable-gold/50"
                  />
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <p className="text-sm text-gray-400">Assign knights to this mission:</p>
              {form.knights.map((knight, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    value={knight.name}
                    onChange={e => updateKnight(idx, 'name', e.target.value)}
                    placeholder="Knight name"
                    className="flex-1 px-3 py-2 bg-roundtable-navy border border-roundtable-steel rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-roundtable-gold/50"
                  />
                  <input
                    value={knight.role}
                    onChange={e => updateKnight(idx, 'role', e.target.value)}
                    placeholder="Role (optional)"
                    className="flex-1 px-3 py-2 bg-roundtable-navy border border-roundtable-steel rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-roundtable-gold/50"
                  />
                  {form.knights.length > 1 && (
                    <button onClick={() => removeKnight(idx)} className="text-gray-500 hover:text-red-400">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={addKnight}
                className="flex items-center gap-1 text-sm text-roundtable-gold hover:text-yellow-300"
              >
                <Plus className="w-4 h-4" /> Add Knight
              </button>
            </>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-300">Mission Summary</h3>
              <div className="bg-roundtable-navy rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Name:</span>
                  <span className="text-white">{form.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Objective:</span>
                  <span className="text-white truncate ml-4">{form.objective}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">RoundTable:</span>
                  <span className="text-white">{form.roundTableRef || '(none)'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Budget:</span>
                  <span className="text-roundtable-gold">${form.costBudgetUSD}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Knights:</span>
                  <span className="text-white">{form.knights.filter(k => k.name.trim()).map(k => k.name).join(', ') || '(none)'}</span>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-roundtable-steel">
          <button
            onClick={() => step > 0 ? setStep(step - 1) : onClose()}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            {step > 0 ? 'Back' : 'Cancel'}
          </button>

          {step < 2 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!steps[step].valid}
              className="px-4 py-2 bg-roundtable-gold/20 border border-roundtable-gold/30 text-roundtable-gold rounded-lg text-sm font-medium hover:bg-roundtable-gold/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 bg-roundtable-gold/20 border border-roundtable-gold/30 text-roundtable-gold rounded-lg text-sm font-medium hover:bg-roundtable-gold/30 disabled:opacity-50"
            >
              <Rocket className="w-4 h-4" />
              {submitting ? 'Dispatching...' : 'Dispatch Mission'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
