import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getPalace, updatePalace, deletePalace, upsertLoci, deleteLocus } from '../../lib/db'
import { SortableList } from '../../components/SortableList'
import PasteLociModal from '../../components/PasteLociModal'
import Button from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import Spinner from '../../components/ui/Spinner'
import { ArrowLeft, Plus, Trash2, Check, X, ClipboardList } from 'lucide-react'

function LocusRow({ locus, onChange, onDelete, isNew }) {
  const [editing, setEditing] = useState(isNew)
  const [name, setName] = useState(locus.name)
  const [descriptor, setDescriptor] = useState(locus.descriptor ?? '')
  const [notes, setNotes] = useState(locus.notes ?? '')

  const save = () => {
    onChange({ ...locus, name, descriptor, notes })
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="bg-slate-700 rounded-xl p-4 flex flex-col gap-3">
        <Input
          placeholder="Locus name (e.g. Front door, Kitchen table…)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus={isNew}
        />
        <Input
          placeholder="Descriptor (e.g. heavy oak door with brass knocker)"
          value={descriptor}
          onChange={(e) => setDescriptor(e.target.value)}
        />
        <Input
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={!name.trim()}>
            <Check size={14} /> Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { if (isNew) onDelete(); else setEditing(false) }}>
            <X size={14} /> Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="bg-slate-800 hover:bg-slate-750 rounded-xl px-4 py-3 flex items-start gap-3 group cursor-pointer transition-colors"
      onClick={() => setEditing(true)}
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-100">{locus.name}</p>
        {locus.descriptor && <p className="text-sm text-slate-400 mt-0.5 truncate">{locus.descriptor}</p>}
        {locus.notes && <p className="text-xs text-slate-500 mt-0.5 truncate italic">{locus.notes}</p>}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        className="p-1.5 rounded-lg hover:bg-red-900/50 text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

export default function PalaceEditor() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [palace, setPalace] = useState(null)
  const [loci, setLoci] = useState([])
  const [loading, setLoading] = useState(true)
  const [palaceName, setPalaceName] = useState('')
  const [palaceDesc, setPalaceDesc] = useState('')
  const [editingMeta, setEditingMeta] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)

  useEffect(() => {
    getPalace(id).then(({ data }) => {
      if (!data) { navigate('/palaces'); return }
      setPalace(data)
      setPalaceName(data.name)
      setPalaceDesc(data.description ?? '')
      const sorted = [...(data.loci ?? [])].sort((a, b) => a.position - b.position)
      setLoci(sorted)
      setLoading(false)
    })
  }, [id])

  const addLocus = () => {
    const tempId = `new-${Date.now()}`
    setLoci((prev) => [...prev, {
      id: tempId,
      palace_id: id,
      name: '',
      descriptor: '',
      notes: '',
      position: prev.length,
      _isNew: true,
    }])
    setDirty(true)
  }

  const updateLocusLocal = (updated) => {
    setLoci((prev) => prev.map((l) => l.id === updated.id ? updated : l))
    setDirty(true)
  }

  const removeLocusLocal = async (locusId) => {
    if (!locusId.startsWith('new-')) await deleteLocus(locusId)
    setLoci((prev) => prev.filter((l) => l.id !== locusId))
    setDirty(true)
  }

  const handleBulkAdd = async (newLoci) => {
    const toInsert = newLoci.map((l, i) => ({
      palace_id: id,
      name: l.name.trim(),
      descriptor: l.descriptor ?? '',
      notes: l.notes ?? '',
      position: loci.length + i,
    }))
    const { data } = await upsertLoci(toInsert)
    if (data) {
      setLoci((prev) => [...prev, ...data].sort((a, b) => a.position - b.position))
    }
  }

  const handleReorder = (reordered) => {
    setLoci(reordered)
    setDirty(true)
  }

  const saveAll = useCallback(async () => {
    setSaving(true)

    if (editingMeta) {
      await updatePalace(id, { name: palaceName, description: palaceDesc })
      setPalace((p) => ({ ...p, name: palaceName, description: palaceDesc }))
      setEditingMeta(false)
    }

    const toSave = loci
      .filter((l) => l.name.trim())
      .map((l, i) => ({
        ...(l._isNew ? {} : { id: l.id }),
        palace_id: id,
        name: l.name.trim(),
        descriptor: l.descriptor ?? '',
        notes: l.notes ?? '',
        position: i,
      }))

    const { data } = await upsertLoci(toSave)
    if (data) {
      setLoci([...data].sort((a, b) => a.position - b.position))
    }
    setDirty(false)
    setSaving(false)
  }, [id, loci, palaceName, palaceDesc, editingMeta])

  const handleDelete = async () => {
    if (!confirm(`Delete "${palace?.name}" and all its loci? This cannot be undone.`)) return
    await deletePalace(id)
    navigate('/palaces')
  }

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Back + title */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/palaces">
          <Button variant="ghost" size="sm"><ArrowLeft size={16} /></Button>
        </Link>
        {editingMeta ? (
          <div className="flex-1 flex flex-col gap-2">
            <Input value={palaceName} onChange={(e) => setPalaceName(e.target.value)} placeholder="Palace name" />
            <Input value={palaceDesc} onChange={(e) => setPalaceDesc(e.target.value)} placeholder="Description" />
            <Button size="sm" variant="ghost" onClick={() => setEditingMeta(false)}>Done</Button>
          </div>
        ) : (
          <div className="flex-1 cursor-pointer" onClick={() => setEditingMeta(true)}>
            <h1 className="text-2xl font-bold text-slate-100 hover:text-amber-300 transition-colors">{palace?.name}</h1>
            {palace?.description && <p className="text-sm text-slate-400">{palace.description}</p>}
          </div>
        )}
      </div>

      {/* Loci */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-200">
          Loci <span className="text-slate-500 font-normal text-sm">({loci.length})</span>
        </h2>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setPasteOpen(true)}>
            <ClipboardList size={14} /> Paste list
          </Button>
          <Button size="sm" variant="secondary" onClick={addLocus}>
            <Plus size={14} /> Add locus
          </Button>
        </div>
      </div>

      {loci.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <p className="mb-4">No loci yet. Add the stations of your journey in order.</p>
          <Button onClick={addLocus} variant="secondary"><Plus size={14} /> Add first locus</Button>
        </div>
      ) : (
        <SortableList
          items={loci}
          onReorder={handleReorder}
          renderItem={(locus) => (
            <LocusRow
              key={locus.id}
              locus={locus}
              isNew={!!locus._isNew}
              onChange={updateLocusLocal}
              onDelete={() => removeLocusLocal(locus.id)}
            />
          )}
        />
      )}

      {/* Save / Delete */}
      <PasteLociModal
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        onImport={handleBulkAdd}
      />

      <div className="mt-8 flex gap-3">
        <Button
          onClick={saveAll}
          disabled={saving || (!dirty && !editingMeta)}
          className="flex-1"
        >
          {saving ? 'Saving…' : dirty || editingMeta ? 'Save changes' : 'Saved ✓'}
        </Button>
        <Button variant="danger" size="md" onClick={handleDelete}>
          <Trash2 size={15} />
        </Button>
      </div>
    </div>
  )
}
