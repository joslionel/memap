import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getJourney, updateAssignment, updateLocus, updateItem, logPractice } from '../../lib/db'
import { sm2 } from '../../lib/sm2'
import { STANDARD_FIELDS } from '../../lib/jsonImport'
import { SortableList } from '../../components/SortableList'
import ConfidenceRater from '../../components/ConfidenceRater'
import Spinner from '../../components/ui/Spinner'
import Button from '../../components/ui/Button'
import { Input, Textarea } from '../../components/ui/Input'
import { ArrowLeft, ArrowRight, Shuffle, ChevronRight, SlidersHorizontal } from 'lucide-react'

const posKey = (id) => `review-pos:${id}`
const configKey = (id) => `review-config:${id}`

function readPos(id) {
  try {
    const n = Number(localStorage.getItem(posKey(id)))
    return Number.isFinite(n) && n >= 0 ? n : 0
  } catch {
    return 0
  }
}

function writePos(id, idx) {
  try { localStorage.setItem(posKey(id), String(idx)) } catch { /* ignore */ }
}

// ─── Field model ─────────────────────────────────────────────────────────────
// A review card is built from a flat, ordered list of fields. Locus data is
// split into three fields so descriptor / notes can be hidden independently.

const LOCUS_FIELDS = [
  { key: 'locus.name',       label: 'Locus',       kind: 'locus', sub: 'name',       type: 'text' },
  { key: 'locus.descriptor', label: 'Descriptor',  kind: 'locus', sub: 'descriptor', type: 'text' },
  { key: 'locus.notes',      label: 'Locus notes', kind: 'locus', sub: 'notes',      type: 'textarea' },
]

const DEFAULT_ON = new Set(['locus.name', 'item.imagery'])

/** All fields available for this journey — locus fields + every item field. */
function buildAllFields(schema, assignments) {
  const mergedData = {}
  for (const a of assignments) Object.assign(mergedData, a?.memory_items?.data ?? {})
  const base = schema && schema.length ? [...schema] : [...STANDARD_FIELDS]
  const known = new Set(base.map(f => f.key))
  for (const k of Object.keys(mergedData)) {
    if (known.has(k)) continue
    const label = k.charAt(0).toUpperCase() + k.slice(1).replace(/([A-Z])/g, ' $1')
    const long = typeof mergedData[k] === 'string' && mergedData[k].length > 60
    base.push({ key: k, label, type: long ? 'textarea' : 'text' })
  }
  const item = base.map(f => ({
    key: `item.${f.key}`, label: f.label, kind: 'item', sub: f.key,
    type: f.type ?? 'text',
  }))
  return [...LOCUS_FIELDS, ...item]
}

function readConfig(id, allFields) {
  let saved = {}
  try { saved = JSON.parse(localStorage.getItem(configKey(id))) || {} } catch { saved = {} }
  const on = saved.on && typeof saved.on === 'object' ? { ...saved.on } : {}
  const heights = saved.heights && typeof saved.heights === 'object' ? { ...saved.heights } : {}
  const known = new Set(allFields.map(f => f.key))
  const order = (Array.isArray(saved.order) ? saved.order : []).filter(k => known.has(k))
  for (const f of allFields) {
    if (!order.includes(f.key)) order.push(f.key)
    if (!(f.key in on)) on[f.key] = DEFAULT_ON.has(f.key)
  }
  return { order, on, heights }
}

function writeConfig(id, cfg) {
  try { localStorage.setItem(configKey(id), JSON.stringify(cfg)) } catch { /* ignore */ }
}

function previewOf(val) {
  const s = String(val ?? '').replace(/\s+/g, ' ').trim()
  return s.length > 60 ? s.slice(0, 60) + '…' : s
}

// ─── Small components ────────────────────────────────────────────────────────

function Collapsible({ label, open, onToggle, preview, accent = false, children }) {
  return (
    <div className={`rounded-xl border overflow-hidden ${accent ? 'border-amber-500/30 bg-slate-800' : 'border-slate-700/70 bg-slate-900/40'}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-700/30 transition-colors"
      >
        <ChevronRight size={13} className={`shrink-0 transition-transform ${open ? 'rotate-90' : ''} ${accent ? 'text-amber-400' : 'text-slate-500'}`} />
        <span className={`text-xs uppercase tracking-wider font-semibold shrink-0 ${accent ? 'text-amber-400' : 'text-slate-400'}`}>{label}</span>
        {!open && preview && <span className="text-xs text-slate-500 truncate">{preview}</span>}
      </button>
      {open && <div className="px-3 pb-3 pt-0.5 flex flex-col gap-3">{children}</div>}
    </div>
  )
}

function SaveStatus({ state, className = '' }) {
  const map = {
    dirty:  ['Unsaved', 'text-slate-500'],
    saving: ['Saving…', 'text-amber-400'],
    saved:  ['Saved',   'text-emerald-400'],
  }
  const s = map[state]
  return (
    <span className={`text-xs shrink-0 text-center ${s ? s[1] : ''} ${className}`}>
      {s ? s[0] : ''}
    </span>
  )
}

// ─── Setup screen ────────────────────────────────────────────────────────────

function valueFor(field, assignment) {
  if (!assignment) return ''
  return field.kind === 'locus'
    ? assignment.loci?.[field.sub] ?? ''
    : assignment.memory_items?.data?.[field.sub] ?? ''
}

function sampleIndices(n, count) {
  const pool = Array.from({ length: n }, (_, i) => i)
  const out = []
  while (out.length < Math.min(count, n)) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0])
  }
  return out.sort((a, b) => a - b)
}

function ReviewSetup({ assignments, allFields, config, onToggleField, onReorderFields, initialIndex, onStart }) {
  const [startIndex, setStartIndex] = useState(initialIndex ?? 0)
  const [previewIdxs, setPreviewIdxs] = useState(() => sampleIndices(assignments.length, 5))

  const orderedFields = config.order
    .map(k => allFields.find(f => f.key === k))
    .filter(Boolean)
  const chosen = orderedFields.filter(f => config.on[f.key])

  return (
    <div className="min-h-full bg-slate-900">
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-100">Set up your review</h1>
          <p className="text-slate-400 text-sm mt-1">
            {assignments.length} loci · pick what shows on each card and drag to reorder.
          </p>
        </div>

        {/* Field picker */}
        <h2 className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-1">Fields to show</h2>
        <p className="text-xs text-slate-500 mb-2">Checked fields open on every card. Unchecked ones stay collapsed — still one tap away.</p>
        <SortableList
          items={orderedFields}
          onReorder={(items) => onReorderFields(items.map(f => f.key))}
          keyExtractor={(f) => f.key}
          renderItem={(f) => (
            <label className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-pointer select-none transition-colors ${
              config.on[f.key] ? 'bg-slate-800 border-slate-600' : 'bg-slate-900/40 border-slate-800'
            }`}>
              <input
                type="checkbox"
                checked={!!config.on[f.key]}
                onChange={() => onToggleField(f.key)}
                className="accent-amber-500 shrink-0"
              />
              <span className={`text-sm ${config.on[f.key] ? 'text-slate-100' : 'text-slate-500'}`}>{f.label}</span>
              <span className="text-[11px] text-slate-600 ml-auto shrink-0">{f.kind}</span>
            </label>
          )}
        />

        {/* Start from */}
        <h2 className="text-xs uppercase tracking-wider font-semibold text-slate-500 mt-6 mb-2">Start from</h2>
        <select
          value={startIndex}
          onChange={(e) => setStartIndex(Number(e.target.value))}
          className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-slate-100 focus:outline-none focus:border-amber-500"
        >
          <option value={-1}>🔀 Random locus</option>
          {assignments.map((a, i) => (
            <option key={a.id} value={i}>
              {i + 1}. {a.loci?.name ?? 'Locus'}
              {a.memory_items?.data?.name ? ` — ${a.memory_items.data.name}` : ''}
            </option>
          ))}
        </select>

        {/* Preview */}
        <div className="flex items-center justify-between mt-6 mb-2">
          <h2 className="text-xs uppercase tracking-wider font-semibold text-slate-500">Preview · 5 cards</h2>
          <button
            onClick={() => setPreviewIdxs(sampleIndices(assignments.length, 5))}
            className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
          >
            <Shuffle size={12} /> Shuffle
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {chosen.length === 0 ? (
            <p className="text-sm text-slate-500 italic py-3">Select at least one field to preview.</p>
          ) : previewIdxs.map((idx) => {
            const a = assignments[idx]
            if (!a) return null
            return (
              <div key={a.id} className="bg-slate-800 rounded-xl p-3 border border-slate-700">
                <p className="text-[11px] text-slate-500 mb-1.5">Card {idx + 1}</p>
                <div className="flex flex-col gap-1.5">
                  {chosen.map((f) => {
                    const v = valueFor(f, a)
                    return (
                      <div key={f.key}>
                        <span className="text-[10px] uppercase tracking-wider text-slate-500">{f.label}</span>
                        <p className="text-sm text-slate-200 whitespace-pre-wrap line-clamp-3">{v || <span className="text-slate-600 italic">empty</span>}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        <Button
          size="lg"
          className="w-full mt-6"
          onClick={() => onStart(startIndex === -1 ? Math.floor(Math.random() * assignments.length) : startIndex)}
        >
          Start review
        </Button>
      </div>
    </div>
  )
}

// ─── Review session ──────────────────────────────────────────────────────────

export default function ReviewSession() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [journey, setJourney] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [schema, setSchema] = useState([])
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [started, setStarted] = useState(false)
  const [current, setCurrent] = useState(0)
  const [confidence, setConfidence] = useState(null)
  const [rated, setRated] = useState(false)

  // Editable drafts for the current card
  const [locusDraft, setLocusDraft] = useState({ name: '', descriptor: '', notes: '' })
  const [itemDraft, setItemDraft] = useState({})
  const [isAside, setIsAside] = useState(false)
  const [saveState, setSaveState] = useState('idle') // idle | dirty | saving | saved

  // Per-field collapse overrides for this session (default comes from config.on)
  const [openOverrides, setOpenOverrides] = useState({})

  // Refs so the unmount / keyboard handlers always see fresh values
  const assignmentsRef = useRef([])
  const currentRef = useRef(0)
  const draftRef = useRef({ locus: locusDraft, item: itemDraft, isAside: false })
  const dirtyRef = useRef(false)

  useEffect(() => { assignmentsRef.current = assignments }, [assignments])
  useEffect(() => { currentRef.current = current }, [current])
  useEffect(() => { draftRef.current = { locus: locusDraft, item: itemDraft, isAside } }, [locusDraft, itemDraft, isAside])

  useEffect(() => {
    getJourney(id).then(({ data }) => {
      if (!data) { navigate('/journeys'); return }
      setJourney(data)
      const sch = data.memory_sets?.schema ?? []
      setSchema(sch)
      const sorted = [...(data.assignments ?? [])]
        .filter(a => a.loci && a.memory_items)
        .sort((a, b) => a.position - b.position)
      setAssignments(sorted)
      setConfig(readConfig(id, buildAllFields(sch, sorted)))
      setLoading(false)
    })
  }, [id, navigate])

  const allFields = useMemo(() => buildAllFields(schema, assignments), [schema, assignments])

  const updateConfig = useCallback((updater) => {
    setConfig((c) => {
      const next = updater(c)
      writeConfig(id, next)
      return next
    })
  }, [id])

  const toggleFieldOn = (key) => updateConfig((c) => ({ ...c, on: { ...c.on, [key]: !c.on[key] } }))
  const reorderFields = (keys) => updateConfig((c) => ({ ...c, order: keys }))
  const setFieldHeight = (key, px) => updateConfig((c) => ({ ...c, heights: { ...c.heights, [key]: px } }))

  const loadDrafts = useCallback((idx) => {
    const a = assignmentsRef.current[idx]
    if (!a) return
    setLocusDraft({
      name: a.loci?.name ?? '',
      descriptor: a.loci?.descriptor ?? '',
      notes: a.loci?.notes ?? '',
    })
    setItemDraft({ ...(a.memory_items?.data ?? {}) })
    setIsAside(!!a.memory_items?.is_aside)
    dirtyRef.current = false
    setSaveState('idle')
  }, [])

  const saveCurrent = useCallback(async () => {
    if (!dirtyRef.current) return
    const idx = currentRef.current
    const a = assignmentsRef.current[idx]
    if (!a) return
    const { locus, item, isAside: aside } = draftRef.current
    dirtyRef.current = false
    setSaveState('saving')

    const ops = []
    let nextLoci = a.loci
    let nextItem = a.memory_items

    if (a.loci?.id) {
      const patch = {
        name: locus.name.trim() || a.loci.name,
        descriptor: locus.descriptor,
        notes: locus.notes,
      }
      if (
        patch.name !== a.loci.name ||
        patch.descriptor !== (a.loci.descriptor ?? '') ||
        patch.notes !== (a.loci.notes ?? '')
      ) {
        nextLoci = { ...a.loci, ...patch }
        ops.push(updateLocus(a.loci.id, patch))
      }
    }

    if (a.memory_items?.id) {
      const dataChanged = JSON.stringify(item) !== JSON.stringify(a.memory_items.data ?? {})
      const asideChanged = aside !== !!a.memory_items.is_aside
      if (dataChanged || asideChanged) {
        nextItem = { ...a.memory_items, data: item, is_aside: aside }
        ops.push(updateItem(a.memory_items.id, { data: item, is_aside: aside }))
      }
    }

    if (!ops.length) { setSaveState('idle'); return }

    try {
      await Promise.all(ops)
      setAssignments(prev => prev.map((x, i) => i === idx ? { ...x, loci: nextLoci, memory_items: nextItem } : x))
      setSaveState('saved')
    } catch (err) {
      console.error('Review autosave failed', err)
      dirtyRef.current = true
      setSaveState('dirty')
    }
  }, [])

  // Debounced autosave while editing
  useEffect(() => {
    if (saveState !== 'dirty') return
    const t = setTimeout(() => { saveCurrent() }, 1500)
    return () => clearTimeout(t)
  }, [saveState, locusDraft, itemDraft, isAside, saveCurrent])

  // Save on unmount (covers navigating away via the nav bar)
  useEffect(() => () => { saveCurrent() }, [saveCurrent])

  const goTo = useCallback(async (idx) => {
    const clamped = Math.max(0, Math.min(idx, assignmentsRef.current.length - 1))
    if (clamped === currentRef.current) return
    await saveCurrent()
    setCurrent(clamped)
    loadDrafts(clamped)
    setConfidence(null)
    setRated(false)
    writePos(id, clamped)
  }, [saveCurrent, loadDrafts, id])

  const move = useCallback((dir) => goTo(currentRef.current + dir), [goTo])

  const randomJump = useCallback(async () => {
    if (assignmentsRef.current.length < 2) return
    let idx = currentRef.current
    while (idx === currentRef.current) idx = Math.floor(Math.random() * assignmentsRef.current.length)
    await goTo(idx)
  }, [goTo])

  const handleStart = (idx) => {
    const clamped = Math.max(0, Math.min(idx, assignments.length - 1))
    setStarted(true)
    setCurrent(clamped)
    loadDrafts(clamped)
    setConfidence(null)
    setRated(false)
    writePos(id, clamped)
  }

  const backToSetup = async () => {
    await saveCurrent()
    setStarted(false)
  }

  const editLocus = (k, v) => { setLocusDraft(d => ({ ...d, [k]: v })); dirtyRef.current = true; setSaveState('dirty') }
  const editItem = (k, v) => { setItemDraft(d => ({ ...d, [k]: v })); dirtyRef.current = true; setSaveState('dirty') }
  const toggleAside = (v) => { setIsAside(v); dirtyRef.current = true; setSaveState('dirty') }

  const handleRate = async (score) => {
    setConfidence(score)
    setRated(true)
    const assignment = assignmentsRef.current[currentRef.current]
    const srUpdate = sm2(assignment, score)
    await updateAssignment(assignment.id, srUpdate)
    await logPractice({ assignment_id: assignment.id, user_id: journey.user_id, confidence: score })
    setAssignments(prev => prev.map((a, i) => i === currentRef.current ? { ...a, ...srUpdate } : a))
  }

  const exitToJourney = async () => {
    await saveCurrent()
    navigate(`/journeys/${id}`)
  }

  // Keyboard arrows for scanning (ignored while typing in a field)
  useEffect(() => {
    if (!started) return
    const handler = (e) => {
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return
      if (e.key === 'ArrowRight') { e.preventDefault(); move(1) }
      if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [started, move])

  if (loading || !config) return (
    <div className="flex items-center justify-center py-24"><Spinner size="lg" /></div>
  )

  if (!assignments.length) return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center text-slate-400">
      <p className="mb-4">This journey has no loci with assigned items yet.</p>
      <Button variant="secondary" onClick={() => navigate(`/journeys/${id}`)}>Open journey editor</Button>
    </div>
  )

  if (!started) {
    return (
      <ReviewSetup
        assignments={assignments}
        allFields={allFields}
        config={config}
        onToggleField={toggleFieldOn}
        onReorderFields={reorderFields}
        initialIndex={Math.min(readPos(id), assignments.length - 1)}
        onStart={handleStart}
      />
    )
  }

  const assignment = assignments[current]
  const total = assignments.length

  const isOpen = (key) => openOverrides[key] ?? config.on[key] ?? false
  const toggleOpen = (key) =>
    setOpenOverrides((o) => ({ ...o, [key]: !(o[key] ?? config.on[key] ?? false) }))

  const orderedFields = config.order.map(k => allFields.find(f => f.key === k)).filter(Boolean)
  const renderFields = [
    ...orderedFields.filter(f => config.on[f.key]),
    ...orderedFields.filter(f => !config.on[f.key]),
  ]
  const fieldValue = (f) => f.kind === 'locus' ? (locusDraft[f.sub] ?? '') : (itemDraft[f.sub] ?? '')
  const editFieldValue = (f, v) => f.kind === 'locus' ? editLocus(f.sub, v) : editItem(f.sub, v)

  return (
    <div className="flex flex-col min-h-full bg-slate-900">
      {/* Sticky header — setup / jump / position / random */}
      <header className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur border-b border-slate-800">
        <div className="max-w-2xl mx-auto px-3 py-2.5 flex items-center gap-2">
          <button
            onClick={exitToJourney}
            title="Back to journey"
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors shrink-0"
          >
            <ArrowLeft size={18} />
          </button>
          <button
            onClick={backToSetup}
            title="Review setup"
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors shrink-0"
          >
            <SlidersHorizontal size={16} />
          </button>
          <select
            value={current}
            onChange={(e) => goTo(Number(e.target.value))}
            className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
          >
            {assignments.map((a, i) => (
              <option key={a.id} value={i}>
                {i + 1}. {a.loci?.name ?? 'Locus'}
                {a.memory_items?.data?.name ? ` — ${a.memory_items.data.name}` : ''}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-500 shrink-0 tabular-nums">{current + 1}/{total}</span>
          <button
            onClick={randomJump}
            title="Jump to random locus"
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-300 transition-colors shrink-0"
          >
            <Shuffle size={16} />
          </button>
        </div>
        <div className="h-1 bg-slate-800">
          <div
            className="h-full bg-amber-500 transition-all duration-300"
            style={{ width: `${((current + 1) / total) * 100}%` }}
          />
        </div>
      </header>

      {/* Card body */}
      <div className="flex-1 w-full max-w-2xl mx-auto px-4 py-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-slate-500 truncate">{journey?.name}</p>
          <div className="flex items-center gap-3 shrink-0">
            <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none">
              <input type="checkbox" checked={isAside} onChange={(e) => toggleAside(e.target.checked)} className="accent-amber-500" />
              Aside
            </label>
            <SaveStatus state={saveState} />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {renderFields.map((f) => (
            <Collapsible
              key={f.key}
              label={f.key === 'locus.name' ? `Locus ${current + 1}` : f.label}
              accent={f.key === 'locus.name'}
              open={isOpen(f.key)}
              onToggle={() => toggleOpen(f.key)}
              preview={previewOf(fieldValue(f))}
            >
              {f.type === 'textarea' ? (
                <Textarea
                  rows={f.key === 'item.imagery' ? 5 : 3}
                  style={config.heights[f.key] ? { height: config.heights[f.key] } : undefined}
                  onMouseUp={(e) => {
                    const h = e.currentTarget.offsetHeight
                    if (h && h !== config.heights[f.key]) setFieldHeight(f.key, h)
                  }}
                  value={fieldValue(f)}
                  onChange={(e) => editFieldValue(f, e.target.value)}
                />
              ) : (
                <Input
                  type={f.type === 'year' || f.type === 'number' ? 'number' : 'text'}
                  className={f.key === 'locus.name' ? 'text-lg font-semibold' : ''}
                  value={fieldValue(f)}
                  onChange={(e) => editFieldValue(f, e.target.value)}
                />
              )}
            </Collapsible>
          ))}
        </div>

        {/* Confidence rating */}
        <div className="mt-5 mb-4">
          <p className="text-sm text-slate-400 mb-3 text-center">How well did you recall this?</p>
          <ConfidenceRater value={confidence} onChange={handleRate} />
          {rated && (
            <p className="text-xs text-center text-slate-500 mt-2">
              Rated {confidence} — next review in {assignment.interval_days ?? 1}d
            </p>
          )}
        </div>
      </div>

      {/* Sticky footer — prev / next */}
      <footer className="sticky bottom-0 z-20 bg-slate-900/95 backdrop-blur border-t border-slate-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => move(-1)}
            disabled={current === 0}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-300 font-medium"
          >
            <ArrowLeft size={18} /> Prev
          </button>
          <SaveStatus state={saveState} className="min-w-[3.5rem]" />
          <button
            onClick={() => move(1)}
            disabled={current === total - 1}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-300 font-medium"
          >
            Next <ArrowRight size={18} />
          </button>
        </div>
      </footer>
    </div>
  )
}
