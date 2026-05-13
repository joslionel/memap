import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSets, deleteSet } from '../../lib/db'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'
import { BookOpen, Plus, Upload, ChevronRight, Trash2 } from 'lucide-react'

export default function SetList() {
  const [sets, setSets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSets().then(({ data }) => {
      setSets(data ?? [])
      setLoading(false)
    })
  }, [])

  const handleDelete = async (id, e) => {
    e.preventDefault()
    if (!confirm('Delete this memory set and all its items?')) return
    await deleteSet(id)
    setSets(sets.filter((s) => s.id !== id))
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Memory Sets</h1>
        <div className="flex gap-2">
          <Link to="/sets/import">
            <Button variant="secondary" size="sm"><Upload size={14} /> Import JSON</Button>
          </Link>
          <Link to="/sets/new">
            <Button size="sm"><Plus size={14} /> New set</Button>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : sets.length === 0 ? (
        <EmptyState
          icon="📚"
          title="No memory sets yet"
          description="Create a set of items to memorise, or import one from JSON."
          action={
            <div className="flex gap-3">
              <Link to="/sets/import"><Button variant="secondary"><Upload size={14} /> Import JSON</Button></Link>
              <Link to="/sets/new"><Button><Plus size={14} /> New set</Button></Link>
            </div>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {sets.map((set) => (
            <Link
              key={set.id}
              to={`/sets/${set.id}`}
              className="bg-slate-800 hover:bg-slate-750 rounded-2xl p-5 flex items-center gap-4 group transition-colors"
            >
              <span className="text-3xl shrink-0">{set.icon ?? '📚'}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-100 group-hover:text-amber-300 transition-colors">{set.title}</p>
                <p className="text-sm text-slate-400 truncate">{set.description || `${set.schema?.length ?? 0} fields defined`}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => handleDelete(set.id, e)}
                  className="p-1.5 rounded-lg hover:bg-red-900/50 text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={15} />
                </button>
                <ChevronRight size={18} className="text-slate-600" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
