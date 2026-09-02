import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getJourney, updateAssignment, updateLocus, updateItem, logPractice } from '../../lib/db'
import { sm2 } from '../../lib/sm2'
import { STANDARD_FIELDS } from '../../lib/jsonImport'
import ConfidenceRater from '../../components/ConfidenceRater'
import Spinner from '../../components/ui/Spinner'
import Button from '../../components/ui/Button'
import { Input, Textarea } from '../../components/ui/Input'
import { ArrowLeft, ArrowRight, Shuffle, ChevronRight } from 'lucide-react'

const posKey = (id) => `review-pos:${id}`
const fieldsKey = (id) => `review-fields:${id}`

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

// Which fields the user has explicitly expanded / collapsed (overrides the defaults)
function readFieldPrefs(id) {
  try {
    const v = JSON.parse(localStorage.getItem(fieldsKey(id)))
    return v && typeof v === 'object' ? v : {}
  } catch {
    return {}
  }
}

function writeFieldPrefs(id, prefs) {
  try { localStorage.setItem(fieldsKey(id), JSON.stringify(prefs)) } catch { /* ignore */ }
}

// Open by default: the locus block and the imagery field. Everything else starts collapsed.
const defaultOpen = (key) => key === '__locus__' || key === 'imagery'

function previewOf(val) {
  const s = String(val ?? '').replace(/\s+/g, ' ').trim()
  return s.length > 60 ? s.slice(0, 60) + '…' : s
}

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

/** Field list for the item — schema fields plus any extra keys present in the data */
function itemFields(schema, data) {
  const base = schema && schema.length ? [...schema] : [...STANDARD_FIELDS]
  const known = new Set(base.map(f => f.key))
  for (const k of Object.keys(data ?? {})) {
    if (known.has(k)) continue
    const label = k.charAt(0).toUpperCase() + k.slice(1).replace(/([A-Z])/g, ' $1')
    const long = typeof data[k] === 'string' && data[k].length > 60
    base.push({ key: k, label, type: long ? 'textarea' : 'text' })
  }
  return base
}

function StartPicker({ assignments, initialIndex, onStart }) {
  const [startIndex, setStartIndex] = useState(initialIndex ?? 0)

  return (
    <div className="min-h-full bg-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🗺</div>
          <h1 className="text-2xl font-bold text-slate-100 mb-2">Review Journey</h1>
          <p className="text-slate-400 text-sm">{assignments.length} loci · scan &amp; edit freely</p>
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

  // Editable drafts for the current card
  const [locusDraft, setLocusDraft] = useState({ name: '', descriptor: '', notes: '' })
  const [itemDraft, setItemDraft] = useState({})
  const [isAside, setIsAside] = useState(false)
  const [saveState, setSaveState] = useState('idle') // idle | dirty | saving | saved

  // Per-field collapsed/expanded state — persists across cards and sessions
  const [fieldPrefs, setFieldPrefs] = useState(() => readFieldPrefs(id))
  const isFieldOpen = (key) => fieldPrefs[key] ?? defaultOpen(key)
  const toggleField = (key) =>
    setFieldPrefs((p) => {
      const next = { ...p, [key]: !(p[key] ?? defaultOpen(key)) }
      writeFieldPrefs(id, next)
      return next
    })

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
      setSchema(data.memory_sets?.schema ?? [])
      const sorted = [...(data.assignments ?? [])]
        .filter(a => a.loci && a.memory_items)
        .sort((a, b) => a.position - b.position)
      setAssignments(sorted)
      setLoading(false)
    })
  }, [id, navigate])

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
    setStarted(true)
    setCurrent(idx)
    loadDrafts(idx)
    setConfidence(null)
    setRated(false)
    writePos(id, idx)
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

  if (loading) return (
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
      <StartPicker
        assignments={assignments}
        initialIndex={Math.min(readPos(id), assignments.length - 1)}
        onStart={handleStart}
      />
    )
  }

  const assignment = assignments[current]
  const fields = itemFields(schema, assignment?.memory_items?.data)
  const total = assignments.length

  return (
    <div className="flex flex-col min-h-full bg-slate-900">
      {/* Sticky header — jump / position / random */}
      <header className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur border-b border-slate-800">
        <div className="max-w-2xl mx-auto px-3 py-2.5 flex items-center gap-2">
          <button
            onClick={exitToJourney}
            title="Back to journey"
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors shrink-0"
          >
            <ArrowLeft size={18} />
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
        {journey?.name && (
          <p className="text-xs text-slate-500 mb-3">{journey.name}</p>
        )}

        {/* Locus — editable, open by default */}
        <div className="mb-3">
          <Collapsible
            label={`Locus ${current + 1}`}
            accent
            open={isFieldOpen('__locus__')}
            onToggle={() => toggleField('__locus__')}
            preview={previewOf(locusDraft.name)}
          >
            <Input
              value={locusDraft.name}
              onChange={(e) => editLocus('name', e.target.value)}
              placeholder="Locus name"
              className="text-lg font-semibold"
            />
            <Input
              value={locusDraft.descriptor}
              onChange={(e) => editLocus('descriptor', e.target.value)}
              placeholder="Descriptor — what it looks like"
            />
            <Textarea
              rows={2}
              value={locusDraft.notes}
              onChange={(e) => editLocus('notes', e.target.value)}
              placeholder="Notes"
            />
          </Collapsible>
        </div>

        {/* Memory item — one collapsible field each; only imagery open by default */}
        <div className="mb-3 flex flex-col gap-2">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Memory item</p>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none">
                <input type="checkbox" checked={isAside} onChange={(e) => toggleAside(e.target.checked)} className="accent-amber-500" />
                Aside
              </label>
              <SaveStatus state={saveState} />
            </div>
          </div>
          {fields.map(field => (
            <Collapsible
              key={field.key}
              label={field.label}
              open={isFieldOpen(field.key)}
              onToggle={() => toggleField(field.key)}
              preview={previewOf(itemDraft[field.key])}
            >
              {field.type === 'textarea' ? (
                <Textarea
                  rows={field.key === 'imagery' ? 5 : 3}
                  value={itemDraft[field.key] ?? ''}
                  onChange={(e) => editItem(field.key, e.target.value)}
                />
              ) : (
                <Input
                  type={field.type === 'year' || field.type === 'number' ? 'number' : 'text'}
                  value={itemDraft[field.key] ?? ''}
                  onChange={(e) => editItem(field.key, e.target.value)}
                />
              )}
            </Collapsible>
          ))}
        </div>

        {/* Confidence rating */}
        <div className="mb-4">
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
