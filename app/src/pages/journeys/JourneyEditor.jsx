import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  getJourney, createJourney, updateJourney, deleteJourney,
  getPalaces, getSets, getSet, createPalace,
  upsertAssignments, upsertLoci, updateAssignment,
} from '../../lib/db'
import { useAuth } from '../../contexts/AuthContext'
import Button from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Input'
import Spinner from '../../components/ui/Spinner'
import Badge from '../../components/ui/Badge'
import { ArrowLeft, Plus, Trash2, Wand2, Link2, Link2Off, BookOpen, Brain, List, MapPin, Check, X, Edit2 } from 'lucide-react'

// ── Locus-centric row ─────────────────────────────────────────────────────────

function AssignmentRow({ assignment, items, onAssign, onClear }) {
  const [picking, setPicking] = useState(false)
  const locus = assignment.loci
  const item = assignment.memory_items
  const unassigned = items.filter(i => !i._assigned || i.id === item?.id)

  return (
    <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
      <div className="px-4 py-2.5 bg-slate-750 border-b border-slate-700 flex items-center gap-2">
        <span className="text-xs font-bold text-amber-400 w-6 text-center">{assignment.position + 1}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-200 truncate">{locus?.name ?? 'Unknown locus'}</p>
          {locus?.descriptor && <p className="text-xs text-slate-500 truncate">{locus.descriptor}</p>}
        </div>
      </div>
      {item ? (
        <div className="px-4 py-3 flex items-start gap-3">
          {item.is_aside && <Badge colour="amber">aside</Badge>}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-100 truncate">{item.data?.name ?? '—'}</p>
            {item.data?.description && <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">{item.data.description}</p>}
          </div>
          <div className="flex gap-1 shrink-0">
            <button onClick={() => setPicking(true)} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors" title="Change"><Link2 size={13} /></button>
            <button onClick={() => onClear(assignment.id)} className="p-1.5 rounded-lg hover:bg-red-900/50 text-slate-600 hover:text-red-400 transition-colors" title="Clear"><Link2Off size={13} /></button>
          </div>
        </div>
      ) : (
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-slate-500 italic">Empty slot</span>
          <button onClick={() => setPicking(true)} className="text-xs text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1">
            <Plus size={12} /> Assign item
          </button>
        </div>
      )}
      {picking && (
        <div className="border-t border-slate-700 bg-slate-850 max-h-48 overflow-y-auto">
          <button onClick={() => { onClear(assignment.id); setPicking(false) }} className="w-full px-4 py-2 text-left text-sm text-slate-500 hover:bg-slate-700 transition-colors">— Clear assignment</button>
          {unassigned.map(i => (
            <button key={i.id} onClick={() => { onAssign(assignment.id, i.id); setPicking(false) }} className="w-full px-4 py-2 text-left text-sm hover:bg-slate-700 transition-colors">
              <span className="text-slate-200">{i.data?.name ?? i.id}</span>
              {i.data?.description && <span className="text-slate-500 ml-2 truncate text-xs">{i.data.description.slice(0, 60)}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Item-centric row ──────────────────────────────────────────────────────────
// mode='assign'  → pick from existing loci dropdown (palace already built)
// mode='build'   → type a new locus name to create it on the fly

function ItemViewRow({ item, index, assignments, mode, onAssign, onClear, onCreateLocus, onEditLocus }) {
  const [picking, setPicking]     = useState(false)
  const [locusInput, setLocusInput] = useState('')
  const [editing, setEditing]     = useState(false)
  const [editVal, setEditVal]     = useState('')

  const current   = assignments.find(a => a.memory_items?.id === item.id)
  const available = assignments
    .filter(a => !a.memory_items?.id || a.memory_items?.id === item.id)
    .sort((a, b) => a.position - b.position)

  const saveNew = () => {
    if (!locusInput.trim()) return
    onCreateLocus(item.id, locusInput.trim())
    setLocusInput('')
  }

  const saveEdit = () => {
    if (!editVal.trim() || !current) return
    onEditLocus(current.loci.id, editVal.trim())
    setEditing(false)
  }

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      {/* Item info */}
      <div className="px-4 py-3 flex items-start gap-3">
        <span className="text-xs font-bold text-slate-500 w-6 shrink-0 mt-0.5 text-right">{index + 1}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-100 truncate">{item.data?.name ?? '(unnamed)'}</p>
          {item.data?.description && <p className="text-xs text-slate-500 truncate mt-0.5">{item.data.description}</p>}
        </div>

        {/* ── Assign mode: show dropdown trigger ── */}
        {mode === 'assign' && (
          <div className="flex items-center gap-1 shrink-0">
            {current && (
              <button onClick={() => onClear(item.id)} className="p-1.5 rounded-lg hover:bg-red-900/50 text-slate-600 hover:text-red-400 transition-colors" title="Clear locus">
                <Link2Off size={12} />
              </button>
            )}
            <button
              onClick={() => setPicking(p => !p)}
              className={`text-xs flex items-center gap-1 px-2 py-1 rounded transition-colors ${current ? 'text-amber-400 hover:text-amber-300' : 'text-slate-400 hover:text-amber-400 border border-slate-600 hover:border-amber-500'}`}
            >
              {current
                ? <><MapPin size={11} /><span className="font-medium">#{current.position + 1}</span><span className="text-slate-300 max-w-[100px] truncate">{current.loci?.name}</span></>
                : <><Plus size={11} /> Assign locus</>}
            </button>
          </div>
        )}

        {/* ── Build mode: show current locus name + edit ── */}
        {mode === 'build' && current && !editing && (
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-xs text-amber-400 flex items-center gap-1">
              <MapPin size={11} />
              <span className="max-w-[120px] truncate">{current.loci?.name}</span>
            </span>
            <button
              onClick={() => { setEditVal(current.loci?.name ?? ''); setEditing(true) }}
              className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-600 hover:text-slate-300 transition-colors"
              title="Edit locus name"
            >
              <Edit2 size={11} />
            </button>
          </div>
        )}
      </div>

      {/* ── Assign mode: locus picker dropdown ── */}
      {mode === 'assign' && picking && (
        <div className="border-t border-slate-700 max-h-56 overflow-y-auto">
          {current && (
            <button onClick={() => { onClear(item.id); setPicking(false) }} className="w-full px-4 py-2 text-left text-sm text-slate-500 hover:bg-slate-700 transition-colors">
              — Remove assignment
            </button>
          )}
          {available.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500 italic">No free loci — all slots filled.</p>
          ) : available.map(a => (
            <button key={a.id} onClick={() => { onAssign(a.id, item.id); setPicking(false) }} className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-700 transition-colors flex items-center gap-3">
              <span className="text-xs font-bold text-amber-400 w-5 text-right shrink-0">{a.position + 1}</span>
              <div className="min-w-0">
                <span className="text-slate-200">{a.loci?.name ?? 'Unknown'}</span>
                {a.loci?.descriptor && <span className="text-slate-500 ml-2 text-xs">{a.loci.descriptor.slice(0, 60)}</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Build mode: inline locus name input ── */}
      {mode === 'build' && !current && (
        <div className="px-4 pb-3 flex gap-2">
          <input
            type="text"
            placeholder="Type locus name and press Enter…"
            value={locusInput}
            onChange={e => setLocusInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveNew()}
            className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
          />
          <button onClick={saveNew} disabled={!locusInput.trim()} className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-900 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1">
            <Check size={13} /> Save
          </button>
        </div>
      )}

      {/* ── Build mode: edit existing locus name ── */}
      {mode === 'build' && editing && (
        <div className="px-4 pb-3 flex gap-2">
          <input
            type="text"
            value={editVal}
            onChange={e => setEditVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false) }}
            autoFocus
            className="flex-1 bg-slate-700 border border-amber-500 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none"
          />
          <button onClick={saveEdit} disabled={!editVal.trim()} className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-900 text-xs font-semibold rounded-lg transition-colors">
            <Check size={13} />
          </button>
          <button onClick={() => setEditing(false)} className="px-2 py-1.5 text-slate-500 hover:text-slate-300 transition-colors">
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main editor ───────────────────────────────────────────────────────────────

export default function JourneyEditor() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const isNew = !id || id === 'new'

  const [journey, setJourney]       = useState(null)
  const [name, setName]             = useState('')
  const [palaceId, setPalaceId]     = useState('')
  const [setId, setSetId]           = useState('')
  const [palaces, setPalaces]       = useState([])
  const [sets, setSets]             = useState([])
  const [assignments, setAssignments] = useState([])
  const [allItems, setAllItems]     = useState([])
  const [loading, setLoading]       = useState(!isNew)
  const [saving, setSaving]         = useState(false)
  const [dirty, setDirty]           = useState(false)

  const [viewMode, setViewMode]               = useState('locus')
  const [showUnassignedOnly, setShowUnassignedOnly] = useState(false)
  const [newPalaceName, setNewPalaceName]     = useState('')
  const [creatingPalace, setCreatingPalace]   = useState(false)

  useEffect(() => {
    getPalaces().then(({ data }) => setPalaces(data ?? []))
    getSets().then(({ data }) => setSets(data ?? []))
  }, [])

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

  useEffect(() => {
    if (!setId) { setAllItems([]); return }
    getSet(setId).then(({ data }) => {
      if (!data) return
      setAllItems([...(data.memory_items ?? [])].sort((a, b) => a.position - b.position))
    })
  }, [setId])

  // When journey name is set and no palace name typed yet, pre-fill it
  useEffect(() => {
    if (name && !newPalaceName) setNewPalaceName(name)
  }, [name])

  const reloadAssignments = async () => {
    const { data: j } = await getJourney(id)
    if (j) setAssignments([...(j.assignments ?? [])].sort((a, b) => a.position - b.position))
  }

  const assignedItemIds = new Set(assignments.map(a => a.memory_items?.id).filter(Boolean))
  const itemsWithFlag   = allItems.map(i => ({ ...i, _assigned: assignedItemIds.has(i.id) }))

  // ── Meta ──────────────────────────────────────────────────────────────────

  const saveMeta = async () => {
    if (!name.trim()) return
    setSaving(true)
    if (isNew) {
      const { data: j } = await createJourney({
        user_id: user.id, name: name.trim(),
        palace_id: palaceId || null, set_id: setId || null,
      })
      if (j && palaceId) await autoAssignNewJourney(j.id, palaceId, setId)
      if (j) navigate(`/journeys/${j.id}`, { replace: true })
    } else {
      await updateJourney(id, { name: name.trim(), palace_id: palaceId || null, set_id: setId || null })
      setJourney(j => ({ ...j, name: name.trim() }))
    }
    setSaving(false)
  }

  const autoAssignNewJourney = async (journeyId, pId, sId) => {
    const palace = palaces.find(p => p.id === pId)
    if (!palace) return
    const loci  = [...(palace.loci ?? [])].sort((a, b) => a.position - b.position)
    let items   = []
    if (sId) {
      const { data: setData } = await getSet(sId)
      items = setData
        ? [...(setData.memory_items ?? [])].filter(i => !i.is_aside).sort((a, b) => a.position - b.position)
        : []
    }
    await upsertAssignments(loci.map((locus, i) => ({
      journey_id: journeyId, locus_id: locus.id,
      item_id: items[i]?.id ?? null, position: i,
    })))
  }

  // ── Locus-view handlers ───────────────────────────────────────────────────

  const buildFromPalace = async () => {
    if (!palaceId) return
    const palace = palaces.find(p => p.id === palaceId)
    if (!palace) return
    const loci = [...(palace.loci ?? [])].sort((a, b) => a.position - b.position)
    const { data } = await upsertAssignments(loci.map((locus, i) => ({
      journey_id: id, locus_id: locus.id, item_id: null, position: i,
    })))
    if (data) await reloadAssignments()
    setDirty(false)
  }

  const autoAssign = async () => {
    const unassigned = itemsWithFlag.filter(i => !i._assigned && !i.is_aside)
    const emptySlots = assignments.filter(a => !a.memory_items?.id)
    const pairs = emptySlots.slice(0, unassigned.length).map((slot, i) => ({ slotId: slot.id, itemId: unassigned[i].id }))
    if (!pairs.length) return
    await Promise.all(pairs.map(({ slotId, itemId }) => updateAssignment(slotId, { item_id: itemId })))
    await reloadAssignments()
  }

  const handleAssign = async (assignmentId, itemId) => {
    await updateAssignment(assignmentId, { item_id: itemId })
    await reloadAssignments()
  }

  const handleClear = async (assignmentId) => {
    await updateAssignment(assignmentId, { item_id: null })
    await reloadAssignments()
  }

  // ── Item-view (assign mode) handlers ─────────────────────────────────────

  const handleAssignByItem = async (locusAssignmentId, itemId) => {
    const prev = assignments.find(a => a.memory_items?.id === itemId)
    if (prev && prev.id !== locusAssignmentId) await updateAssignment(prev.id, { item_id: null })
    await updateAssignment(locusAssignmentId, { item_id: itemId })
    await reloadAssignments()
  }

  const handleClearByItem = async (itemId) => {
    const a = assignments.find(a => a.memory_items?.id === itemId)
    if (!a) return
    await updateAssignment(a.id, { item_id: null })
    await reloadAssignments()
  }

  // ── Item-view (build mode) handlers ──────────────────────────────────────

  // Create the palace for this journey (once) before building starts
  const handleStartBuilding = async () => {
    setCreatingPalace(true)
    const pName = newPalaceName.trim() || name.trim() || 'New Palace'
    const { data: palace } = await createPalace({ user_id: user.id, name: pName, description: '' })
    if (!palace) { setCreatingPalace(false); return }
    await updateJourney(id, { palace_id: palace.id })
    setPalaceId(palace.id)
    setPalaces(prev => [palace, ...prev])
    setCreatingPalace(false)
  }

  // Type a new locus name → create locus in palace → create assignment
  const handleCreateAndAssign = async (itemId, locusName) => {
    if (!palaceId) return
    const nextPos = assignments.length
    const { data: newLoci } = await upsertLoci([{
      palace_id: palaceId, name: locusName,
      descriptor: '', notes: '', position: nextPos,
    }])
    if (!newLoci?.[0]) return
    await upsertAssignments([{
      journey_id: id, locus_id: newLoci[0].id,
      item_id: itemId, position: nextPos,
    }])
    await reloadAssignments()
  }

  // Edit an already-typed locus name in place
  const handleEditLocusName = async (locusId, newName) => {
    const a = assignments.find(a => a.loci?.id === locusId)
    if (!a?.loci) return
    await upsertLoci([{ ...a.loci, palace_id: palaceId, name: newName }])
    await reloadAssignments()
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!confirm('Delete this journey?')) return
    await deleteJourney(id)
    navigate('/journeys')
  }

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>

  const assignedCount  = assignments.filter(a => a.memory_items?.id).length
  const totalItems     = allItems.filter(i => !i.is_aside).length
  const progressDenom  = viewMode === 'item' && totalItems ? totalItems : assignments.length
  const progressPct    = progressDenom > 0 ? Math.round((assignedCount / progressDenom) * 100) : 0
  const progressLabel  = viewMode === 'item'
    ? `${assignedCount} of ${totalItems || '?'} items assigned`
    : `${assignedCount} of ${assignments.length} slots filled`

  // In build mode, we always show all non-aside items (palace built item by item)
  const isBuildMode = viewMode === 'item' && (!assignments.length || !palaceId)
  const visibleItems = itemsWithFlag
    .filter(i => !i.is_aside)
    .filter(i => !showUnassignedOnly || !i._assigned)

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/journeys"><Button variant="ghost" size="sm"><ArrowLeft size={16} /></Button></Link>
        <h1 className="text-2xl font-bold text-slate-100">{isNew ? 'New journey' : (journey?.name ?? 'Journey')}</h1>
      </div>

      {/* Meta form */}
      <div className="bg-slate-800 rounded-2xl p-6 flex flex-col gap-4 mb-6">
        <Input label="Journey name *" placeholder="e.g. 100 Dates via My Childhood Home"
          value={name} onChange={e => setName(e.target.value)} />
        <Select label="Palace (optional — can be built as you go)" value={palaceId}
          onChange={e => { setPalaceId(e.target.value); setDirty(true) }}>
          <option value="">— No palace yet —</option>
          {palaces.map(p => <option key={p.id} value={p.id}>{p.name} ({p.loci?.length ?? 0} loci)</option>)}
        </Select>
        <Select label="Memory set" value={setId}
          onChange={e => { setSetId(e.target.value); setDirty(true) }}>
          <option value="">— Select a memory set —</option>
          {sets.map(s => <option key={s.id} value={s.id}>{s.icon} {s.title}</option>)}
        </Select>
        <Button onClick={saveMeta} disabled={saving || !name.trim()}>
          {saving ? 'Saving…' : isNew ? 'Create journey' : 'Save'}
        </Button>
      </div>

      {/* Assignments */}
      {!isNew && (
        <>
          {/* Header */}
          <div className="flex items-start justify-between mb-4 gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-200">Assignments</h2>
              {(assignments.length > 0 || totalItems > 0) && (
                <>
                  <p className="text-sm text-slate-500">{progressLabel}</p>
                  {progressDenom > 0 && (
                    <div className="mt-1.5 w-40 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex flex-col items-end gap-2">
              {/* View toggle — shown when a set is linked */}
              {setId && (assignments.length > 0 || totalItems > 0) && (
                <div className="flex rounded-lg overflow-hidden border border-slate-700 text-xs">
                  <button onClick={() => setViewMode('locus')}
                    className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors ${viewMode === 'locus' ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:text-slate-200'}`}>
                    <MapPin size={12} /> By locus
                  </button>
                  <button onClick={() => setViewMode('item')}
                    className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors border-l border-slate-700 ${viewMode === 'item' ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:text-slate-200'}`}>
                    <List size={12} /> By item
                  </button>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                {assignments.length === 0 && palaceId && viewMode === 'locus' && (
                  <Button size="sm" variant="secondary" onClick={buildFromPalace}>
                    <Wand2 size={13} /> Build from palace
                  </Button>
                )}
                {assignments.length > 0 && assignedCount < assignments.length && setId && viewMode === 'locus' && (
                  <Button size="sm" variant="secondary" onClick={autoAssign}>
                    <Wand2 size={13} /> Auto-assign
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* ── Locus view ── */}
          {viewMode === 'locus' && (
            assignments.length === 0 ? (
              <div className="text-center py-10 text-slate-500">
                <p className="mb-4">{palaceId ? 'Click "Build from palace" to create loci slots.' : 'Select a palace above, or switch to "By item" to build one as you go.'}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {assignments.map(a => (
                  <AssignmentRow key={a.id} assignment={a} items={itemsWithFlag} onAssign={handleAssign} onClear={handleClear} />
                ))}
              </div>
            )
          )}

          {/* ── Item view ── */}
          {viewMode === 'item' && (
            <div className="flex flex-col gap-2">

              {/* No set selected */}
              {!setId && (
                <p className="text-center py-8 text-slate-500">Select a memory set above to see items here.</p>
              )}

              {/* No palace yet → prompt to create one */}
              {setId && !palaceId && (
                <div className="bg-slate-800 border border-slate-600 rounded-2xl p-5 flex flex-col gap-3 mb-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-200 mb-1">No palace yet</p>
                    <p className="text-xs text-slate-400">Give your new palace a name and start typing loci for each item below. Everything saves as you go.</p>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Palace name…"
                      value={newPalaceName}
                      onChange={e => setNewPalaceName(e.target.value)}
                      className="flex-1"
                    />
                    <Button onClick={handleStartBuilding} disabled={creatingPalace || !newPalaceName.trim()}>
                      {creatingPalace ? <Spinner size="sm" /> : 'Start building'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Items list */}
              {setId && (palaceId || assignments.length > 0) && (
                <>
                  {/* Filter + mode info */}
                  <div className="flex items-center justify-between mb-1">
                    <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer select-none">
                      <input type="checkbox" checked={showUnassignedOnly} onChange={e => setShowUnassignedOnly(e.target.checked)} className="accent-amber-500" />
                      Unassigned only
                      {showUnassignedOnly && <span className="text-amber-400 font-medium">({visibleItems.length} left)</span>}
                    </label>
                    {isBuildMode && (
                      <span className="text-xs text-slate-500 italic">Type a locus name for each item</span>
                    )}
                  </div>

                  {visibleItems.length === 0 ? (
                    <p className="text-center py-8 text-slate-500">
                      {showUnassignedOnly ? '🎉 All items have a locus!' : 'No items in this set.'}
                    </p>
                  ) : (
                    visibleItems.map((item) => {
                      const itemIndex = allItems.filter(x => !x.is_aside).indexOf(item)
                      return (
                        <ItemViewRow
                          key={item.id}
                          item={item}
                          index={itemIndex}
                          assignments={assignments}
                          mode={isBuildMode ? 'build' : 'assign'}
                          onAssign={handleAssignByItem}
                          onClear={handleClearByItem}
                          onCreateLocus={handleCreateAndAssign}
                          onEditLocus={handleEditLocusName}
                        />
                      )
                    })
                  )}
                </>
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
