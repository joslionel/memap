import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getJourneys, deleteJourney } from '../../lib/db'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'
import { Map, Plus, ChevronRight, BookOpen, Brain, Trash2 } from 'lucide-react'

export default function JourneyList() {
  const [journeys, setJourneys] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getJourneys().then(({ data }) => {
      setJourneys(data ?? [])
      setLoading(false)
    })
  }, [])

  const handleDelete = async (id, e) => {
    e.preventDefault()
    if (!confirm('Delete this journey and all its assignments?')) return
    await deleteJourney(id)
    setJourneys(journeys.filter((j) => j.id !== id))
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Journeys</h1>
        <Link to="/journeys/new">
          <Button size="sm"><Plus size={14} /> New journey</Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : journeys.length === 0 ? (
        <EmptyState
          icon="🗺"
          title="No journeys yet"
          description="A journey links a palace (loci) to a memory set (items). Create both first, then link them here."
          action={<Link to="/journeys/new"><Button>Create a journey</Button></Link>}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {journeys.map((j) => (
            <div key={j.id} className="bg-slate-800 rounded-2xl p-5 flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <Map size={22} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-100">{j.name}</p>
                  <p className="text-sm text-slate-400 mt-0.5">
                    🏛 {j.palaces?.name ?? 'No palace'} · {j.memory_sets?.icon ?? '📚'} {j.memory_sets?.title ?? 'No set'}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={(e) => handleDelete(j.id, e)}
                    className="p-1.5 rounded-lg hover:bg-red-900/50 text-slate-600 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                  <Link to={`/journeys/${j.id}`}>
                    <button className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors">
                      <ChevronRight size={16} />
                    </button>
                  </Link>
                </div>
              </div>

              <div className="flex gap-2">
                <Link to={`/journeys/${j.id}/review`} className="flex-1">
                  <Button variant="secondary" size="sm" className="w-full">
                    <BookOpen size={13} /> Review
                  </Button>
                </Link>
                <Link to={`/journeys/${j.id}/practice`} className="flex-1">
                  <Button size="sm" className="w-full">
                    <Brain size={13} /> Practice
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
