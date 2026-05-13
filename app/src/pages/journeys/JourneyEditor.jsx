import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  getJourney, createJourney, updateJourney, deleteJourney,
  getPalaces, getSets, getSet,
  upsertAssignments, updateAssignment, deleteAssignment,
} from '../../lib/db'
import { useAuth } from '../../contexts/AuthContext'
import Button from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'
import Badge from '../../components/ui/Badge'
import { ArrowLeft, Plus, Trash2, Wand2, Link2, Link2Off, BookOpen, Brain } from 'lucide-react'

function AssignmentRow({ assignment, items, onAssign, onClear }) {
  const [picking, setPicking] = useState(false)
  const locus = assignment.loci
  const item = assignment.memory_items
  const unassigned = items.filter(i => !i._assigned || i.id === item?.id)

  return (
    <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
      {/* Locus header */}
      <div className="px-4 py-2.5 bg-slate-750 border-b border-slate-700 flex items-center gap-2">
        <span className="text-xs font-bold text-amber-400 w-6 text-center">{assignment.position + 1}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-200 truncate">{locus?.name ?? 'Unknown locus'}</p>
          {locus?.descriptor && <p className="text-xs text-slate-500 truncate">{locus.descriptor}</p>}
        </div>
      </div>

      {/* Assigned item */}
      {item ? (
        <div className="px-4 py-3 flex items-start gap-3">
          {item.is_aside && <Badge colour="amber">aside</Badge>}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-100 truncate">{item.data?.name ?? '—'}</p>
            {item.data?.description && (
              <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">{item.data.description}</p>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            <button
              onClick={() => setPicking(true)}
              className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors"
              title="Change assignment"
            >
              <Link2 size={13} />
            </button>
            <button
              onClick={() => onClear(assignment.id)}
              className="p-1.5 rounded-lg hover:bg-red-900/50 text-slate-600 hover:text-red-400 transition-colors"
              title="Clear assignment"
            >
              <Link2Off size={13} />
            </button>
          </div>
        </div>
      ) : (
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-slate-500 italic">Empty slot</span>
          <button
            onClick={() => setPicking(true)}
            className="text-xs text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1"
          >
            <Plus size={12} /> Assign item
          </button>
        </div>
      )}

      {/* Item picker */}
      {picking && (
        <div className="border-t border-slate-700 bg-slate-850 max-h-48 overflow-y-auto">
          <button
            onClick={() => { onClear(assignment.id); setPicking(false) }}
            className="w-full px-4 py-2 text-left text-sm text-slate-500 hover:bg-slate-700 transition-colors"
          >
            — Clear assignment
          </button>
          {unassigned.map((i) => (
            <button
              key={i.id}
              onClick={() => { onAssign(assignment.id, i.id); setPicking(false) }}
              className="w-full px-4 py-2 text-left text-sm hover:bg-slate-700 transition-colors"
            >
              <span className="text-slate-200">{i.data?.name ?? i.id}</span>
              {i.data?.description && (
                <span className="text-slate-500 ml-2 truncate text-xs">{i.data.description.slice(0, 60)}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function JourneyEditor() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const isNew = !id || id === 'new'

  const [journey, setJourney] = useState(null)
  const [name, setName] = useState('')
  const [palaceId, setPalaceId] = useState('')
  const [setId, setSetId] = useState('')
  const [palaces, setPalaces] = useState([])
  const [sets, setSets] = useState([])
  const [assignments, setAssignments] = useState([])   // {id, position, loci, memory_items}
  const [allItems, setAllItems] = useState([])         // flat list from the chosen set
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  // Load palaces and sets for selects
  useEffect(() => {
    getPalaces().then(({ data }) => setPalaces(data ?? []))
    getSets().then(({ data }) => setSets(data ?? []))
  }, [])

  // Load existing journey
  useEffect(() => {
    if (isNew) return
    getJourney(id).then(({ data }) => {
      if (!data) { navigate('/journeys'); return }
      setJourney(data)
      setName(data.name)
      setPalaceId(data.palace_id ?? '')
      setSetId(data.set_id ?? '')
      const sorted = [...(data.assignments ?? [])].sort((a, b) => a.position - b.position)
      setAssignments(sorted)
      setLoading(false)
    })
  }, [id])

  // When set changes, load items
  useEffect(() => {
    if (!setId) { setAllItems([]); return }
    getSet(setId).then(({ data }) => {
      if (!data) return
      const sorted = [...(data.memory_items ?? [])].sort((a, b) => a.position - b.position)
      setAllItems(sorted)
    })
  }, [setId])

  // Mark which items are already assigned
  const assignedItemIds = new Set(assignments.map(a => a.memory_items?.id).filter(Boolean))
  const itemsWithFlag = allItems.map(i => ({ ...i, _assigned: assignedItemIds.has(i.id) }))

  const saveMeta = async () => {
    if (!name.trim()) return
    setSaving(true)
    if (isNew) {
      const { data: journey } = await createJourney({ user_id: user.id, name: name.trim(), palace_id: palaceId || null, set_id: setId || null })
      if (journey && palaceId) {
        await autoAssignNewJourney(journey.id, palaceId, setId)
      }
      if (journey) navigate(`/journeys/${journey.id}`, { replace: true })
    } else {
      await updateJourney(id, { name: name.trim(), palace_id: palaceId || null, set_id: setId || null })
      setJourney(j => ({ ...j, name: name.trim() }))
    }
    setSaving(false)
  }

  // Build loci slots and auto-assign items in one shot (used when creating a new journey)
  const autoAssignNewJourney = async (journeyId, pId, sId) => {
    const palace = palaces.find(p => p.id === pId)
    if (!palace) return
    const loci = [...(palace.loci ?? [])].sort((a, b) => a.position - b.position)

    let items = []
    if (sId) {
      const { data: setData } = await getSet(sId)
      items = setData
        ? [...(setData.memory_items ?? [])].filter(i => !i.is_aside).sort((a, b) => a.position - b.position)
        : []
    }

    const newAssignments = loci.map((locus, i) => ({
      journey_id: journeyId,
      locus_id: locus.id,
      item_id: items[i]?.id ?? null,
      position: i,
    }))

    await upsertAssignments(newAssignments)
  }

  // Build assignments from palace loci
  const buildFromPalace = async () => {
    if (!palaceId) return
    const palace = palaces.find(p => p.id === palaceId)
    if (!palace) return
    const loci = [...(palace.loci ?? [])].sort((a, b) => a.position - b.position)

    const newAssignments = loci.map((locus, i) => ({
      journey_id: id,
      locus_id: locus.id,
      item_id: null,
      position: i,
    }))

    const { data } = await upsertAssignments(newAssignments)
    if (data) {
      // Reload to get full loci/items join
      const { data: j } = await getJourney(id)
      if (j) setAssignments([...(j.assignments ?? [])].sort((a, b) => a.position - b.position))
    }
    setDirty(false)
  }

  // Auto-assign items to empty slots in order
  const autoAssign = async () => {
    const unassigned = itemsWithFlag.filter(i => !i._assigned && !i.is_aside)
    const emptySlots = assignments.filter(a => !a.memory_items?.id)
    const pairs = emptySlots.slice(0, unassigned.length).map((slot, i) => ({
      slotId: slot.id, itemId: unassigned[i].id,
    }))
    if (!pairs.length) return
    await Promise.all(pairs.map(({ slotId, itemId }) => updateAssignment(slotId, { item_id: itemId })))
    const { data: j } = await getJourney(id)
    if (j) setAssignments([...(j.assignments ?? [])].sort((a, b) => a.position - b.position))
  }

  const handleAssign = async (assignmentId, itemId) => {
    await updateAssignment(assignmentId, { item_id: itemId })
    const { data: j } = await getJourney(id)
    if (j) setAssignments([...(j.assignments ?? [])].sort((a, b) => a.position - b.position))
  }

  const handleClear = async (assignmentId) => {
    await updateAssignment(assignmentId, { item_id: null })
    const { data: j } = await getJourney(id)
    if (j) setAssignments([...(j.assignments ?? [])].sort((a, b) => a.position - b.position))
  }

  const handleDelete = async () => {
    if (!confirm('Delete this journey?')) return
    await deleteJourney(id)
    navigate('/journeys')
  }

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>

  const assignedCount = assignments.filter(a => a.memory_items?.id).length

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/journeys"><Button variant="ghost" size="sm"><ArrowLeft size={16} /></Button></Link>
        <h1 className="text-2xl font-bold text-slate-100">{isNew ? 'New journey' : (journey?.name ?? 'Journey')}</h1>
      </div>

      {/* Meta form */}
      <div className="bg-slate-800 rounded-2xl p-6 flex flex-col gap-4 mb-6">
        <Input
          label="Journey name *"
          placeholder="e.g. Roman Emperors via Aberystwyth"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Select
          label="Palace"
          value={palaceId}
          onChange={(e) => { setPalaceId(e.target.value); setDirty(true) }}
        >
          <option value="">— Select a palace —</option>
          {palaces.map(p => (
            <option key={p.id} value={p.id}>{p.name} ({p.loci?.length ?? 0} loci)</option>
          ))}
        </Select>
        <Select
          label="Memory set"
          value={setId}
          onChange={(e) => { setSetId(e.target.value); setDirty(true) }}
        >
          <option value="">— Select a memory set —</option>
          {sets.map(s => <option key={s.id} value={s.id}>{s.icon} {s.title}</option>)}
        </Select>
        <Button onClick={saveMeta} disabled={saving || !name.trim()}>
          {saving ? 'Saving…' : isNew ? 'Create journey' : 'Save'}
        </Button>
      </div>

      {/* Assignments (only shown for saved journeys) */}
      {!isNew && (
        <>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-200">Loci assignments</h2>
              <p className="text-sm text-slate-500">{assignedCount} of {assignments.length} slots filled</p>
            </div>
            <div className="flex gap-2">
              {assignments.length === 0 && palaceId && (
                <Button size="sm" variant="secondary" onClick={buildFromPalace}>
                  <Wand2 size={13} /> Build from palace
                </Button>
              )}
              {assignments.length > 0 && assignedCount < assignments.length && setId && (
                <Button size="sm" variant="secondary" onClick={autoAssign}>
                  <Wand2 size={13} /> Auto-assign
                </Button>
              )}
            </div>
          </div>

          {assignments.length === 0 ? (
            <div className="text-center py-10 text-slate-500">
              <p className="mb-4">No loci yet.{palaceId ? ' Click "Build from palace" to add loci from the selected palace.' : ' Select a palace above first.'}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {assignments.map((a) => (
                <AssignmentRow
                  key={a.id}
                  assignment={a}
                  items={itemsWithFlag}
                  onAssign={handleAssign}
                  onClear={handleClear}
                />
              ))}
            </div>
          )}

          {/* Unassigned items */}
          {setId && itemsWithFlag.filter(i => !i._assigned && !i.is_aside).length > 0 && (
            <div className="mt-6 bg-slate-800/50 rounded-xl p-4">
              <p className="text-sm text-slate-400 mb-2">
                <strong className="text-slate-300">{itemsWithFlag.filter(i => !i._assigned && !i.is_aside).length}</strong> items from the set are not yet assigned.
              </p>
              {assignments.length < allItems.filter(i => !i.is_aside).length && (
                <p className="text-xs text-slate-500">You can extend this journey by adding more loci to the palace, then rebuilding from palace.</p>
              )}
            </div>
          )}

          {/* Practice buttons */}
          {assignedCount > 0 && (
            <div className="flex gap-3 mt-6">
              <Link to={`/journeys/${id}/review`} className="flex-1">
                <Button variant="secondary" className="w-full"><BookOpen size={15} /> Review journey</Button>
              </Link>
              <Link to={`/journeys/${id}/practice`} className="flex-1">
                <Button className="w-full"><Brain size={15} /> Practice recall</Button>
              </Link>
            </div>
          )}

          {/* Delete */}
          <div className="mt-10 pt-6 border-t border-slate-800">
            <Button variant="danger" onClick={handleDelete} className="w-full">
              <Trash2 size={15} /> Delete journey
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
