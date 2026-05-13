import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getPalaces, createPalace, deletePalace } from '../../lib/db'
import { useAuth } from '../../contexts/AuthContext'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'
import { Input } from '../../components/ui/Input'
import { Building2, Plus, Upload, ChevronRight, Trash2 } from 'lucide-react'

export default function PalaceList() {
  const { user } = useAuth()
  const [palaces, setPalaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getPalaces().then(({ data }) => {
      setPalaces(data ?? [])
      setLoading(false)
    })
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    setSaving(true)
    const { data } = await createPalace({
      user_id: user.id,
      name: newName.trim(),
      description: newDesc.trim(),
    })
    if (data) {
      setPalaces([data, ...palaces])
      setNewName('')
      setNewDesc('')
      setCreating(false)
    }
    setSaving(false)
  }

  const handleDelete = async (id, e) => {
    e.preventDefault()
    if (!confirm('Delete this palace and all its loci?')) return
    await deletePalace(id)
    setPalaces(palaces.filter((p) => p.id !== id))
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Palaces</h1>
        <div className="flex gap-2">
          <Link to="/palaces/import">
            <Button variant="secondary" size="sm"><Upload size={14} /> Import</Button>
          </Link>
          <Button onClick={() => setCreating(true)} size="sm">
            <Plus size={16} /> New palace
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : palaces.length === 0 ? (
        <EmptyState
          icon="🏛"
          title="No palaces yet"
          description="A palace is a real or imagined place whose rooms and routes become your loci."
          action={<Button onClick={() => setCreating(true)}>Create a palace</Button>}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {palaces.map((palace) => (
            <Link
              key={palace.id}
              to={`/palaces/${palace.id}`}
              className="bg-slate-800 hover:bg-slate-750 rounded-2xl p-5 flex items-center gap-4 group transition-colors"
            >
              <Building2 size={24} className="text-amber-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-100 group-hover:text-amber-300 transition-colors">{palace.name}</p>
                <p className="text-sm text-slate-400 truncate">{palace.description || `${palace.loci?.length ?? 0} loci`}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 hidden sm:block">{palace.loci?.length ?? 0} loci</span>
                <button
                  onClick={(e) => handleDelete(palace.id, e)}
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

      <Modal open={creating} onClose={() => setCreating(false)} title="New palace">
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <Input
            label="Palace name"
            placeholder="e.g. My childhood home, The British Museum…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
            autoFocus
          />
          <Input
            label="Description (optional)"
            placeholder="A brief note about this place"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
          />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setCreating(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? 'Creating…' : 'Create palace'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
