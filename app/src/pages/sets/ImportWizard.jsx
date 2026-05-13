import { useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { parseRaw, preprocessItems, detectMapping, normaliseItem, buildSchema, STANDARD_FIELDS, DATE_FIELDS, FIELD_MAP } from '../../lib/jsonImport'
import { createSet, upsertItems } from '../../lib/db'
import { useAuth } from '../../contexts/AuthContext'
import Button from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'
import { ArrowLeft, Upload, ChevronRight, Check, AlertCircle } from 'lucide-react'

const STEP = { UPLOAD: 0, MAP: 1, PREVIEW: 2, DONE: 3 }

const ALL_DEST_KEYS = [
  { value: '',            label: '— skip —' },
  { value: 'name',        label: 'Name' },
  { value: 'description', label: 'Description (fact)' },
  { value: 'imagery',     label: 'Imagery (mnemonic)' },
  { value: 'notes',       label: 'Notes' },
  { value: 'startDate',   label: 'Start year' },
  { value: 'endDate',     label: 'End year' },
  { value: '__custom__',  label: '+ Keep as custom field' },
]

export default function ImportWizard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const fileRef = useRef()

  const [step, setStep] = useState(STEP.UPLOAD)
  const [error, setError] = useState('')
  const [rawItems, setRawItems] = useState([])
  const [meta, setMeta] = useState(null)
  const [mappings, setMappings] = useState({})     // srcKey → destKey
  const [extraFields, setExtraFields] = useState([])
  const [hasDates, setHasDates] = useState(false)
  const [setTitle, setSetTitle] = useState('')
  const [setIcon, setSetIcon] = useState('📚')
  const [setDesc, setSetDesc] = useState('')
  const [importing, setImporting] = useState(false)

  const handleFile = async (file) => {
    setError('')
    try {
      const text = await file.text()
      const { meta: m, rawItems: raw } = parseRaw(text)
      const items = preprocessItems(raw)
      const { suggestedMappings, extraFields: extras, hasDates: dates } = detectMapping(items, m)
      setRawItems(items)
      setMeta(m)
      setMappings(suggestedMappings)
      setExtraFields(extras)
      setHasDates(dates)
      setSetTitle(m?.name ?? file.name.replace(/\.json$/, ''))
      setSetIcon(m?.icon ?? '📚')
      setSetDesc(m?.subtitle ?? '')
      setStep(STEP.MAP)
    } catch (e) {
      setError(e.message)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleImport = async () => {
    setImporting(true)
    const schema = buildSchema(hasDates, extraFields)
    const { data: newSet, error: setErr } = await createSet({
      user_id: user.id,
      title: setTitle,
      description: setDesc,
      icon: setIcon,
      schema,
    })
    if (setErr || !newSet) { setError(setErr?.message ?? 'Failed to create set'); setImporting(false); return }

    const normalisedItems = rawItems.map((raw, i) => ({
      set_id: newSet.id,
      ...normaliseItem(raw, mappings, i),
    }))

    // Batch in chunks of 100
    for (let i = 0; i < normalisedItems.length; i += 100) {
      await upsertItems(normalisedItems.slice(i, i + 100))
    }

    setImporting(false)
    setStep(STEP.DONE)
    setTimeout(() => navigate(`/sets/${newSet.id}`), 1500)
  }

  const previewItems = rawItems.slice(0, 3)

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/sets"><Button variant="ghost" size="sm"><ArrowLeft size={16} /></Button></Link>
        <h1 className="text-2xl font-bold text-slate-100">Import from JSON</h1>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8 text-sm">
        {['Upload', 'Map fields', 'Preview & import'].map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
              ${step === i ? 'bg-amber-500 text-slate-900' : step > i ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
              {step > i ? <Check size={12} /> : i + 1}
            </div>
            <span className={step >= i ? 'text-slate-200' : 'text-slate-500'}>{label}</span>
            {i < 2 && <ChevronRight size={14} className="text-slate-600" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-900/30 border border-red-700 rounded-xl p-4 mb-6 text-sm text-red-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Step 0: Upload */}
      {step === STEP.UPLOAD && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-slate-600 hover:border-amber-500 rounded-2xl p-12 text-center cursor-pointer transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={36} className="mx-auto text-slate-500 mb-4" />
          <p className="text-slate-300 font-medium mb-1">Drop a JSON file here</p>
          <p className="text-slate-500 text-sm">or click to select</p>
          <p className="text-slate-600 text-xs mt-4">Supports plain arrays and {'{ meta, items }'} format</p>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])} />
        </div>
      )}

      {/* Step 1: Map fields */}
      {step === STEP.MAP && (
        <div className="flex flex-col gap-6">
          {/* Set metadata */}
          <div className="bg-slate-800 rounded-2xl p-5 flex flex-col gap-4">
            <h2 className="font-semibold text-slate-200">Set details</h2>
            <div className="flex gap-3">
              <Input label="Icon" value={setIcon} onChange={(e) => setSetIcon(e.target.value)} className="w-20 text-center text-xl" />
              <Input label="Title" value={setTitle} onChange={(e) => setSetTitle(e.target.value)} className="flex-1" />
            </div>
            <Input label="Description" value={setDesc} onChange={(e) => setSetDesc(e.target.value)} />
          </div>

          {/* Field mapping */}
          <div className="bg-slate-800 rounded-2xl p-5 flex flex-col gap-4">
            <div>
              <h2 className="font-semibold text-slate-200 mb-1">Field mapping</h2>
              <p className="text-xs text-slate-400">
                We detected {Object.keys(mappings).length} fields. Confirm how each maps to the app schema,
                or set to "skip" to ignore it.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {Object.entries(mappings).map(([src, dest]) => (
                <div key={src} className="flex items-center gap-3">
                  <code className="text-xs bg-slate-700 px-2 py-1 rounded text-amber-300 w-32 shrink-0 truncate">{src}</code>
                  <ChevronRight size={14} className="text-slate-500 shrink-0" />
                  <Select
                    value={dest}
                    onChange={(e) => setMappings({ ...mappings, [src]: e.target.value })}
                    className="flex-1 text-sm"
                  >
                    {ALL_DEST_KEYS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    <option value={src}>Keep as "{src}"</option>
                  </Select>
                </div>
              ))}
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={hasDates}
                onChange={(e) => setHasDates(e.target.checked)}
                className="accent-amber-500"
              />
              Include date fields (start/end year) in schema
            </label>
          </div>

          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep(STEP.UPLOAD)} className="flex-1">Back</Button>
            <Button onClick={() => setStep(STEP.PREVIEW)} className="flex-1">
              Preview <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === STEP.PREVIEW && (
        <div className="flex flex-col gap-6">
          <div className="bg-slate-800 rounded-2xl p-5">
            <h2 className="font-semibold text-slate-200 mb-3">
              Preview — first {previewItems.length} of {rawItems.length} items
            </h2>
            <div className="flex flex-col gap-3">
              {previewItems.map((raw, i) => {
                const norm = normaliseItem(raw, mappings, i)
                return (
                  <div key={i} className={`border border-slate-700 rounded-xl p-4 ${norm.is_aside ? 'border-amber-600/50' : ''}`}>
                    {norm.is_aside && <Badge colour="amber">aside</Badge>}
                    {Object.entries(norm.data).map(([k, v]) => (
                      v ? <div key={k} className="mt-1">
                        <span className="text-xs text-slate-500 uppercase">{k}: </span>
                        <span className="text-sm text-slate-300">{String(v).slice(0, 120)}{String(v).length > 120 ? '…' : ''}</span>
                      </div> : null
                    ))}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-slate-800 rounded-2xl p-4 text-sm text-slate-400">
            Ready to import <strong className="text-slate-200">{rawItems.length} items</strong> into a new set called <strong className="text-slate-200">{setTitle}</strong>.
          </div>

          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep(STEP.MAP)} className="flex-1">Back</Button>
            <Button onClick={handleImport} disabled={importing} className="flex-1">
              {importing ? <><Spinner size="sm" /> Importing…</> : `Import ${rawItems.length} items`}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Done */}
      {step === STEP.DONE && (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-semibold text-slate-100 mb-2">Import complete!</h2>
          <p className="text-slate-400">Redirecting to your new set…</p>
        </div>
      )}
    </div>
  )
}
