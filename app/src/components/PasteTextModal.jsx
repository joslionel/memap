import { useState, useMemo } from 'react'
import Modal from './ui/Modal'
import Button from './ui/Button'
import { Input } from './ui/Input'
import { Plus, X, ChevronRight, ChevronLeft, Check } from 'lucide-react'

const STEP = { PASTE: 0, MAP: 1, PREVIEW: 2 }

const PRIMARY_OPTS = [
  { value: 'line',   label: 'By line',      hint: 'Each line → one card' },
  { value: 'blank',  label: 'By blank line', hint: 'Paragraphs → one card each' },
  { value: 'custom', label: 'Custom',        hint: 'Your own delimiter' },
]

const SECONDARY_OPTS = [
  { value: 'none',       label: 'No further split',  hint: 'Whole chunk → one field' },
  { value: 'first_rest', label: 'First line + rest',  hint: 'Line 1 → A, rest → B' },
  { value: 'delim',      label: 'By delimiter',       hint: 'Split on a separator' },
  { value: 'line_pos',   label: 'By line position',   hint: 'Each line → its own field' },
]

const FIELD_TYPES = [
  { value: 'text',     label: 'Text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'year',     label: 'Year' },
  { value: 'number',   label: 'Number' },
]

function labelToKey(label) {
  return label.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || 'field'
}

function splitText(text, mode, custom) {
  if (!text.trim()) return []
  const delim =
    mode === 'line'  ? /\r?\n/ :
    mode === 'blank' ? /\r?\n\s*\r?\n+/ :
    custom || /\r?\n/
  return text.split(delim).map(s => s.trim()).filter(Boolean)
}

function applyMapping(chunk, config) {
  const data = {}
  const lines = chunk.split(/\r?\n/).filter(Boolean)

  switch (config.mode) {
    case 'none':
      data[config.fields[0].key] = chunk
      break
    case 'first_rest':
      data[config.fields[0].key] = lines[0] ?? ''
      data[config.fields[1].key] = lines.slice(1).join('\n')
      break
    case 'delim': {
      const parts = chunk.split(config.delim)
      config.fields.forEach((f, i) => {
        // last named field absorbs any overflow
        data[f.key] = (i < config.fields.length - 1
          ? parts[i]
          : parts.slice(i).join(config.delim)
        )?.trim() ?? ''
      })
      break
    }
    case 'line_pos':
      config.fields.forEach((f, i) => {
        // last named field absorbs remaining lines
        data[f.key] = i < config.fields.length - 1
          ? (lines[i] ?? '')
          : lines.slice(i).join('\n')
      })
      break
  }
  return data
}

function makeDefaultFields(mode, sampleChunk, delim) {
  const lines = sampleChunk.split(/\r?\n/).filter(Boolean)
  if (mode === 'none') {
    return [{ label: 'Content', key: 'content', type: 'textarea' }]
  }
  if (mode === 'first_rest') {
    return [
      { label: 'Name',        key: 'name',        type: 'text' },
      { label: 'Description', key: 'description', type: 'textarea' },
    ]
  }
  if (mode === 'delim') {
    const parts = sampleChunk.split(delim)
    return parts.slice(0, 5).map((_, i) => ({
      label: i === 0 ? 'Name' : i === 1 ? 'Description' : `Field ${i + 1}`,
      key:   i === 0 ? 'name' : i === 1 ? 'description' : `field_${i + 1}`,
      type: i === 0 ? 'text' : 'textarea',
    }))
  }
  if (mode === 'line_pos') {
    return lines.slice(0, Math.min(lines.length, 3)).map((_, i) => ({
      label: i === 0 ? 'Name' : i === 1 ? 'Description' : 'Imagery',
      key:   i === 0 ? 'name' : i === 1 ? 'description' : 'imagery',
      type:  i === 0 ? 'text' : 'textarea',
    }))
  }
  return []
}

export default function PasteTextModal({ open, onClose, onImport, existingSchema = [] }) {
  const [step, setStep] = useState(STEP.PASTE)

  // Step 0
  const [text, setText] = useState('')
  const [primaryMode, setPrimaryMode] = useState('line')
  const [primaryCustom, setPrimaryCustom] = useState('')

  // Step 1
  const [secondaryMode, setSecondaryMode] = useState('none')
  const [secondaryDelim, setSecondaryDelim] = useState(' — ')
  const [mappedFields, setMappedFields] = useState([
    { label: 'Content', key: 'content', type: 'textarea' },
  ])
  const [extraFields, setExtraFields] = useState([])
  const [newExtraLabel, setNewExtraLabel] = useState('')
  const [newExtraType, setNewExtraType] = useState('textarea')

  const chunks = useMemo(
    () => splitText(text, primaryMode, primaryCustom),
    [text, primaryMode, primaryCustom]
  )

  const sampleChunk = chunks[0] ?? ''
  const sampleLines = sampleChunk.split(/\r?\n/).filter(Boolean)

  const mappingConfig = useMemo(() => {
    const fields =
      secondaryMode === 'none'       ? mappedFields.slice(0, 1) :
      secondaryMode === 'first_rest' ? mappedFields.slice(0, 2) :
      mappedFields
    return { mode: secondaryMode, delim: secondaryDelim, fields }
  }, [secondaryMode, secondaryDelim, mappedFields])

  const previewItems = useMemo(
    () => chunks.slice(0, 3).map((chunk, i) => ({
      position: i, is_aside: false, data: applyMapping(chunk, mappingConfig),
    })),
    [chunks, mappingConfig]
  )

  const allNewFields = useMemo(() => {
    return [...mappingConfig.fields, ...extraFields]
      .filter(f => !existingSchema.find(s => s.key === f.key))
  }, [mappingConfig.fields, extraFields, existingSchema])

  // ── field list helpers ──
  const setField = (i, updates) =>
    setMappedFields(prev => prev.map((f, idx) =>
      idx === i ? { ...f, ...updates, key: labelToKey(updates.label ?? f.label) } : f
    ))

  const addMappedSlot = () =>
    setMappedFields(prev => [
      ...prev,
      { label: `Field ${prev.length + 1}`, key: `field_${prev.length + 1}`, type: 'textarea' },
    ])

  const removeMappedSlot = (i) =>
    setMappedFields(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev)

  const handleSecondaryMode = (mode) => {
    setSecondaryMode(mode)
    setMappedFields(makeDefaultFields(mode, sampleChunk, secondaryDelim))
  }

  const handleDelimChange = (d) => {
    setSecondaryDelim(d)
    if (secondaryMode === 'delim') {
      const parts = sampleChunk.split(d)
      const count = Math.min(parts.length, 5)
      setMappedFields(prev => {
        const next = [...prev]
        while (next.length < count)
          next.push({ label: `Field ${next.length + 1}`, key: `field_${next.length + 1}`, type: 'textarea' })
        return next.slice(0, count)
      })
    }
  }

  const addExtraField = () => {
    if (!newExtraLabel.trim()) return
    const key = labelToKey(newExtraLabel)
    if ([...mappedFields, ...extraFields].find(f => f.key === key)) return
    setExtraFields(prev => [...prev, { label: newExtraLabel.trim(), key, type: newExtraType, required: false }])
    setNewExtraLabel('')
  }

  const reset = () => {
    setStep(STEP.PASTE)
    setText('')
    setPrimaryMode('line')
    setPrimaryCustom('')
    setSecondaryMode('none')
    setSecondaryDelim(' — ')
    setMappedFields([{ label: 'Content', key: 'content', type: 'textarea' }])
    setExtraFields([])
    setNewExtraLabel('')
  }

  const handleClose = () => { reset(); onClose() }

  const handleImport = () => {
    const items = chunks.map((chunk, i) => ({
      position: i, is_aside: false, data: applyMapping(chunk, mappingConfig),
    }))
    onImport(items, allNewFields)
    handleClose()
  }

  // ── field hint helper ──
  const fieldHint = (i, isLast) => {
    if (secondaryMode === 'none') return 'Whole chunk'
    if (secondaryMode === 'first_rest') return i === 0 ? 'Line 1' : 'Remaining lines'
    if (secondaryMode === 'delim') {
      const parts = sampleChunk.split(secondaryDelim)
      const raw = (parts[i] ?? '').trim().slice(0, 35)
      return isLast ? `Part ${i + 1}+: ${raw}` : `Part ${i + 1}: ${raw}`
    }
    if (secondaryMode === 'line_pos') {
      const raw = (sampleLines[i] ?? '').slice(0, 35)
      return isLast ? `Line ${i + 1}+: ${raw}` : `Line ${i + 1}: ${raw}`
    }
    return ''
  }

  return (
    <Modal open={open} onClose={handleClose} title="Paste text" maxWidth="max-w-2xl">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-5 text-xs">
        {['Paste & split', 'Map fields', 'Preview'].map((label, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold ${
              step === i ? 'bg-amber-500 text-slate-900' :
              step > i  ? 'bg-green-600 text-white' :
                          'bg-slate-700 text-slate-400'
            }`}>
              {step > i ? <Check size={10} /> : i + 1}
            </div>
            <span className={step >= i ? 'text-slate-300' : 'text-slate-500'}>{label}</span>
            {i < 2 && <ChevronRight size={12} className="text-slate-600" />}
          </div>
        ))}
      </div>

      {/* ── Step 0: PASTE ── */}
      {step === STEP.PASTE && (
        <div className="flex flex-col gap-4">
          <textarea
            placeholder="Paste your text here…"
            value={text}
            onChange={e => setText(e.target.value)}
            rows={12}
            className="bg-slate-900 border border-slate-600 rounded-xl px-3 py-2.5 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500 font-mono text-sm resize-y w-full"
          />

          <div>
            <p className="text-sm text-slate-400 mb-2">Split into cards by</p>
            <div className="flex flex-wrap gap-2">
              {PRIMARY_OPTS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setPrimaryMode(opt.value)}
                  className={`flex flex-col items-start px-3 py-2 rounded-xl text-sm transition-colors border ${
                    primaryMode === opt.value
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <span className="font-medium">{opt.label}</span>
                  <span className="text-xs opacity-60">{opt.hint}</span>
                </button>
              ))}
            </div>
            {primaryMode === 'custom' && (
              <div className="mt-2">
                <Input
                  placeholder="Delimiter (e.g.  ;  |  ###)"
                  value={primaryCustom}
                  onChange={e => setPrimaryCustom(e.target.value)}
                />
              </div>
            )}
          </div>

          {chunks.length > 0 && (
            <p className="text-sm text-slate-400">
              <span className="text-amber-400 font-semibold">{chunks.length}</span> cards detected
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <Button variant="ghost" onClick={handleClose} className="flex-1">Cancel</Button>
            <Button onClick={() => setStep(STEP.MAP)} disabled={!chunks.length} className="flex-1">
              Map fields <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 1: MAP ── */}
      {step === STEP.MAP && (
        <div className="flex flex-col gap-5">
          {/* Sample chunk */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1.5">
              Sample card (1 of {chunks.length})
            </p>
            <pre className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-300 whitespace-pre-wrap font-mono max-h-28 overflow-y-auto leading-relaxed">
              {sampleChunk || '—'}
            </pre>
          </div>

          {/* Secondary split choice */}
          <div>
            <p className="text-sm text-slate-400 mb-2">How to read each card</p>
            <div className="grid grid-cols-2 gap-2">
              {SECONDARY_OPTS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleSecondaryMode(opt.value)}
                  className={`flex flex-col items-start px-3 py-2.5 rounded-xl text-sm transition-colors border ${
                    secondaryMode === opt.value
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <span className="font-medium">{opt.label}</span>
                  <span className="text-xs opacity-60">{opt.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Field mapping config */}
          <div className="bg-slate-800 rounded-xl p-4 flex flex-col gap-3">
            {secondaryMode === 'delim' && (
              <Input
                label="Delimiter"
                placeholder="e.g.  —   |   \t   ;"
                value={secondaryDelim}
                onChange={e => handleDelimChange(e.target.value)}
              />
            )}

            <div className="flex flex-col gap-2">
              {mappingConfig.fields.map((field, i) => {
                const isLast = i === mappingConfig.fields.length - 1
                const hint = fieldHint(i, isLast)
                const canRemove = (secondaryMode === 'delim' || secondaryMode === 'line_pos') && mappingConfig.fields.length > 1

                return (
                  <div key={i} className="flex items-center gap-2 min-w-0">
                    <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                    <span className="text-xs text-slate-500 w-36 truncate shrink-0" title={hint}>{hint}</span>
                    <span className="text-slate-600 text-sm shrink-0">→</span>
                    <input
                      value={field.label}
                      onChange={e => setField(i, { label: e.target.value })}
                      placeholder={`Field ${i + 1}`}
                      className="bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-sm text-slate-100 focus:outline-none focus:border-amber-500 flex-1 min-w-0"
                    />
                    <select
                      value={field.type}
                      onChange={e => setField(i, { type: e.target.value })}
                      className="bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none shrink-0"
                    >
                      {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    {canRemove && (
                      <button onClick={() => removeMappedSlot(i)} className="text-slate-600 hover:text-red-400 transition-colors p-1 shrink-0">
                        <X size={12} />
                      </button>
                    )}
                  </div>
                )
              })}

              {(secondaryMode === 'delim' || secondaryMode === 'line_pos') && mappingConfig.fields.length < 6 && (
                <button
                  onClick={addMappedSlot}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors mt-1 w-fit"
                >
                  <Plus size={12} /> Add another field slot
                </button>
              )}
            </div>
          </div>

          {/* Extra empty fields */}
          <div>
            <p className="text-sm text-slate-400 mb-2">
              Extra schema fields <span className="text-slate-600">(empty in pasted items, fill in later)</span>
            </p>
            <div className="flex flex-wrap gap-2 mb-2">
              {extraFields.map(f => (
                <div key={f.key} className="flex items-center gap-1.5 bg-slate-700 rounded-lg px-2.5 py-1 text-sm">
                  <span className="text-slate-300">{f.label}</span>
                  <button
                    onClick={() => setExtraFields(prev => prev.filter(x => x.key !== f.key))}
                    className="text-slate-500 hover:text-red-400 transition-colors"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 items-end">
              <Input
                placeholder="Field label (e.g. Imagery, Notes…)"
                value={newExtraLabel}
                onChange={e => setNewExtraLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addExtraField()}
                className="flex-1"
              />
              <select
                value={newExtraType}
                onChange={e => setNewExtraType(e.target.value)}
                className="bg-slate-800 border border-slate-600 rounded-xl px-2 py-2 text-sm text-slate-300 focus:outline-none shrink-0"
              >
                {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <Button size="sm" variant="secondary" onClick={addExtraField} disabled={!newExtraLabel.trim()}>
                <Plus size={14} />
              </Button>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="ghost" onClick={() => setStep(STEP.PASTE)} className="flex-1">
              <ChevronLeft size={14} /> Back
            </Button>
            <Button onClick={() => setStep(STEP.PREVIEW)} className="flex-1">
              Preview <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 2: PREVIEW ── */}
      {step === STEP.PREVIEW && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-400">
            First {previewItems.length} of{' '}
            <span className="text-amber-400 font-semibold">{chunks.length}</span> cards:
          </p>

          <div className="flex flex-col gap-3 max-h-72 overflow-y-auto pr-1">
            {previewItems.map((item, i) => (
              <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Card {i + 1}</p>
                {Object.entries(item.data).map(([key, val]) =>
                  val ? (
                    <div key={key} className="mb-2">
                      <span className="text-xs text-amber-400 uppercase tracking-wider">{key} </span>
                      <span className="text-sm text-slate-300 whitespace-pre-wrap">
                        {String(val).slice(0, 200)}{String(val).length > 200 ? '…' : ''}
                      </span>
                    </div>
                  ) : null
                )}
                {extraFields.length > 0 && (
                  <p className="text-xs text-slate-600 italic mt-1">
                    + {extraFields.map(f => f.label).join(', ')} (empty)
                  </p>
                )}
              </div>
            ))}
          </div>

          {allNewFields.length > 0 && (
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 text-xs text-slate-400">
              New schema fields:{' '}
              {allNewFields.map(f => (
                <span key={f.key} className="text-amber-300 mr-2">{f.label}</span>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep(STEP.MAP)} className="flex-1">
              <ChevronLeft size={14} /> Back
            </Button>
            <Button onClick={handleImport} className="flex-1">
              Import {chunks.length} cards
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
