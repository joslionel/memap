import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getJourney, updateAssignment, logPractice } from '../../lib/db'
import { sm2 } from '../../lib/sm2'
import ConfidenceRater from '../../components/ConfidenceRater'
import Spinner from '../../components/ui/Spinner'
import Button from '../../components/ui/Button'
import { ArrowLeft, ArrowRight, X, Shuffle } from 'lucide-react'

function ItemField({ label, value }) {
  if (!value && value !== 0) return null
  return (
    <div className="mb-4">
      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">{value}</p>
    </div>
  )
}

function StartPicker({ assignments, onStart }) {
  const [startIndex, setStartIndex] = useState(0)

  return (
    <div className="min-h-dvh bg-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🗺</div>
          <h1 className="text-2xl font-bold text-slate-100 mb-2">Review Journey</h1>
          <p className="text-slate-400 text-sm">{assignments.length} loci · navigate freely</p>
        </div>

        <div className="bg-slate-800 rounded-2xl p-6 flex flex-col gap-4">
          <div>
            <p className="text-sm text-slate-400 mb-2">Start from</p>
            <select
              value={startIndex}
              onChange={(e) => setStartIndex(Number(e.target.value))}
              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-slate-100 focus:outline-none focus:border-amber-500"
            >
              <option value={-1}>🔀 Random locus</option>
              {assignments.map((a, i) => (
                <option key={a.id} value={i}>
                  {i + 1}. {a.loci?.name ?? 'Locus'}
                  {a.memory_items?.data?.name ? ` — ${a.memory_items.data.name}` : ''}
                </option>
              ))}
            </select>
          </div>

          <Button
            onClick={() => {
              const idx = startIndex === -1
                ? Math.floor(Math.random() * assignments.length)
                : startIndex
              onStart(idx)
            }}
            size="lg"
            className="w-full"
          >
            Begin
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function ReviewSession() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [journey, setJourney] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [schema, setSchema] = useState([])
  const [loading, setLoading] = useState(true)
  const [started, setStarted] = useState(false)
  const [current, setCurrent] = useState(0)
  const [confidence, setConfidence] = useState(null)
  const [rated, setRated] = useState(false)

  useEffect(() => {
    getJourney(id).then(({ data }) => {
      if (!data) { navigate('/journeys'); return }
      setJourney(data)
      setSchema(data.memory_sets?.schema ?? [])
      const sorted = [...(data.assignments ?? [])]
        .filter(a => a.loci && a.memory_items)
        .sort((a, b) => a.position - b.position)
      setAssignments(sorted)
      setLoading(false)
    })
  }, [id])

  const handleStart = (idx) => {
    setCurrent(idx)
    setStarted(true)
    setConfidence(null)
    setRated(false)
  }

  const move = (dir) => {
    const next = current + dir
    if (next < 0 || next >= assignments.length) return
    setCurrent(next)
    setConfidence(null)
    setRated(false)
  }

  const handleRate = async (score) => {
    setConfidence(score)
    setRated(true)
    const assignment = assignments[current]
    const srUpdate = sm2(assignment, score)
    await updateAssignment(assignment.id, srUpdate)
    await logPractice({ assignment_id: assignment.id, user_id: journey.user_id, confidence: score })
    // Update local state
    setAssignments(prev => prev.map((a, i) => i === current ? { ...a, ...srUpdate } : a))
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-dvh bg-slate-900"><Spinner size="lg" /></div>
  )

  if (!started) {
    return <StartPicker assignments={assignments} onStart={handleStart} />
  }

  const assignment = assignments[current]
  const locus = assignment?.loci
  const item = assignment?.memory_items

  return (
    <div className="min-h-dvh bg-slate-900 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <button
          onClick={() => navigate(`/journeys/${id}`)}
          className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
        >
          <X size={20} />
        </button>
        <div className="text-center">
          <p className="text-sm font-medium text-slate-300">{journey?.name}</p>
          <p className="text-xs text-slate-500">{current + 1} / {assignments.length}</p>
        </div>
        <button
          onClick={() => { setCurrent(Math.floor(Math.random() * assignments.length)); setConfidence(null); setRated(false) }}
          className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-300 transition-colors"
          title="Jump to random locus"
        >
          <Shuffle size={18} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-slate-800">
        <div
          className="h-full bg-amber-500 transition-all duration-300"
          style={{ width: `${((current + 1) / assignments.length) * 100}%` }}
        />
      </div>

      {/* Card content */}
      <div className="flex-1 overflow-y-auto px-4 py-6 max-w-2xl mx-auto w-full">
        {/* Locus */}
        <div className="bg-slate-800 rounded-2xl p-5 mb-4 border border-amber-500/30">
          <p className="text-xs text-amber-400 uppercase tracking-wider mb-2 font-semibold">Locus {current + 1}</p>
          <p className="text-xl font-bold text-slate-100 mb-1">{locus?.name}</p>
          {locus?.descriptor && <p className="text-slate-400 text-sm">{locus.descriptor}</p>}
          {locus?.notes && <p className="text-slate-500 text-xs italic mt-1">{locus.notes}</p>}
        </div>

        {/* Item */}
        {item && (
          <div className="bg-slate-800 rounded-2xl p-5 mb-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 font-semibold">Memory item</p>
            {item.is_aside && (
              <div className="mb-3 px-3 py-1.5 bg-amber-900/30 border border-amber-700/50 rounded-lg inline-block">
                <span className="text-xs text-amber-400 font-semibold">ASIDE</span>
              </div>
            )}
            {schema.map(field => (
              <ItemField
                key={field.key}
                label={field.label}
                value={item.data?.[field.key]}
              />
            ))}
          </div>
        )}

        {/* Confidence rating */}
        <div className="mb-6">
          <p className="text-sm text-slate-400 mb-3 text-center">How well did you recall this?</p>
          <ConfidenceRater value={confidence} onChange={handleRate} />
          {rated && (
            <p className="text-xs text-center text-slate-500 mt-2">
              Rated {confidence} — next review in {assignment.interval_days ?? 1}d
            </p>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="px-4 pb-6 pt-3 border-t border-slate-800 flex items-center gap-3 max-w-2xl mx-auto w-full">
        <button
          onClick={() => move(-1)}
          disabled={current === 0}
          className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-300 font-medium"
        >
          <ArrowLeft size={20} /> Previous
        </button>
        <button
          onClick={() => move(1)}
          disabled={current === assignments.length - 1}
          className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-300 font-medium"
        >
          Next <ArrowRight size={20} />
        </button>
      </div>
    </div>
  )
}
