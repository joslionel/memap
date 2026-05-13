import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getJourney, updateAssignment, logPractice } from '../../lib/db'
import { sm2, practiceScore } from '../../lib/sm2'
import ConfidenceRater from '../../components/ConfidenceRater'
import Spinner from '../../components/ui/Spinner'
import Button from '../../components/ui/Button'
import { X, Eye, EyeOff } from 'lucide-react'

function ItemField({ label, value }) {
  if (!value && value !== 0) return null
  return (
    <div className="mb-4">
      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">{value}</p>
    </div>
  )
}

export default function PracticeSession() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [journey, setJourney] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [schema, setSchema] = useState([])
  const [loading, setLoading] = useState(true)

  const [queue, setQueue] = useState([])       // ordered by score, refilled each pass
  const [current, setCurrent] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, total: 0 })
  const [done, setDone] = useState(false)

  useEffect(() => {
    getJourney(id).then(({ data }) => {
      if (!data) { navigate('/journeys'); return }
      setJourney(data)
      setSchema(data.memory_sets?.schema ?? [])
      const valid = (data.assignments ?? []).filter(a => a.loci && a.memory_items)
      setAssignments(valid)
      setSessionStats({ reviewed: 0, total: valid.length })
      const sorted = [...valid].sort((a, b) => practiceScore(b) - practiceScore(a))
      setQueue(sorted)
      setCurrent(sorted[0] ?? null)
      setLoading(false)
    })
  }, [id])

  const handleReveal = () => setRevealed(true)

  const handleRate = useCallback(async (score) => {
    if (!current) return
    const srUpdate = sm2(current, score)
    await updateAssignment(current.id, srUpdate)
    await logPractice({ assignment_id: current.id, user_id: journey.user_id, confidence: score })

    // Update assignment in master list
    const updatedAssignment = { ...current, ...srUpdate }
    setAssignments(prev => prev.map(a => a.id === current.id ? updatedAssignment : a))

    setSessionStats(s => ({ ...s, reviewed: s.reviewed + 1 }))

    // Build next queue: remaining assignments minus current, sorted by score
    setQueue(prev => {
      const remaining = prev.filter(a => a.id !== current.id)
      if (remaining.length === 0) {
        // All done for this pass — check if any need another round (score < 4)
        const needsReview = assignments
          .map(a => a.id === current.id ? updatedAssignment : a)
          .filter(a => (a.last_confidence ?? 0) < 4)
          .sort((a, b) => practiceScore(b) - practiceScore(a))

        if (needsReview.length === 0) {
          setDone(true)
          setCurrent(null)
          return []
        }
        setCurrent(needsReview[0])
        setRevealed(false)
        return needsReview.slice(1)
      }

      const next = remaining[0]
      setCurrent(next)
      setRevealed(false)
      return remaining.slice(1)
    })
  }, [current, assignments, journey])

  if (loading) return (
    <div className="flex items-center justify-center min-h-dvh bg-slate-900"><Spinner size="lg" /></div>
  )

  if (done) return (
    <div className="min-h-dvh bg-slate-900 flex items-center justify-center p-6">
      <div className="text-center">
        <div className="text-6xl mb-6">🎉</div>
        <h1 className="text-2xl font-bold text-slate-100 mb-2">Session complete!</h1>
        <p className="text-slate-400 mb-2">{sessionStats.reviewed} items reviewed</p>
        <p className="text-slate-500 text-sm mb-8">All items rated 4+ — well done.</p>
        <div className="flex gap-3 justify-center">
          <Button variant="secondary" onClick={() => navigate(`/journeys/${id}`)}>Back to journey</Button>
          <Button onClick={() => window.location.reload()}>Practice again</Button>
        </div>
      </div>
    </div>
  )

  const locus = current?.loci
  const item = current?.memory_items
  const progress = sessionStats.total > 0
    ? (sessionStats.reviewed / sessionStats.total) * 100
    : 0

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
          <p className="text-xs text-slate-500">
            {sessionStats.reviewed} reviewed · {queue.length + 1} remaining
          </p>
        </div>
        <div className="w-10" />
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-slate-800">
        <div
          className="h-full bg-amber-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Card */}
      <div className="flex-1 overflow-y-auto px-4 py-6 max-w-2xl mx-auto w-full">
        {/* Locus — always visible */}
        <div className="bg-slate-800 rounded-2xl p-5 mb-4 border border-amber-500/30">
          <p className="text-xs text-amber-400 uppercase tracking-wider mb-2 font-semibold">Your locus</p>
          <p className="text-xl font-bold text-slate-100 mb-1">{locus?.name}</p>
          {locus?.descriptor && <p className="text-slate-400 text-sm">{locus.descriptor}</p>}
          {locus?.notes && <p className="text-slate-500 text-xs italic mt-1">{locus.notes}</p>}
        </div>

        {/* Recall prompt */}
        {!revealed ? (
          <div className="bg-slate-800 rounded-2xl p-6 mb-4 text-center border border-slate-700 border-dashed">
            <EyeOff size={28} className="mx-auto text-slate-600 mb-3" />
            <p className="text-slate-400 mb-4">What memory is associated with this locus?</p>
            <p className="text-xs text-slate-600 mb-6">Recall it vividly before revealing the answer.</p>
            <Button onClick={handleReveal} size="lg" className="w-full">
              <Eye size={16} /> Reveal answer
            </Button>
          </div>
        ) : (
          <div className="bg-slate-800 rounded-2xl p-5 mb-4 border border-green-800/40">
            <p className="text-xs text-green-400 uppercase tracking-wider mb-3 font-semibold">Answer</p>
            {item?.is_aside && (
              <div className="mb-3 px-3 py-1.5 bg-amber-900/30 border border-amber-700/50 rounded-lg inline-block">
                <span className="text-xs text-amber-400 font-semibold">ASIDE</span>
              </div>
            )}
            {schema.map(field => (
              <ItemField
                key={field.key}
                label={field.label}
                value={item?.data?.[field.key]}
              />
            ))}
          </div>
        )}

        {/* Confidence rater — only shown after reveal */}
        {revealed && (
          <div className="mb-6">
            <p className="text-sm text-slate-400 mb-3 text-center">How well did you recall it?</p>
            <ConfidenceRater onChange={handleRate} />
            <p className="text-xs text-center text-slate-600 mt-2">
              Rating will update your spaced repetition schedule
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
