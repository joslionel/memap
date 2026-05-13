import { useState, useMemo } from 'react'
import Modal from './ui/Modal'
import Button from './ui/Button'
import { Input } from './ui/Input'
import { ChevronRight, ChevronLeft } from 'lucide-react'

const STEP = { CONFIG: 0, PREVIEW: 1 }

function splitText(text, mode, custom) {
  if (!text.trim()) return []
  const delim =
    mode === 'line'  ? /\r?\n/ :
    mode === 'blank' ? /\r?\n\s*\r?\n+/ :
    custom || /\r?\n/
  return text.split(delim).map(s => s.trim()).filter(Boolean)
}

const PRIMARY_OPTS = [
  { value: 'line',   label: 'By line',      hint: 'Each line → one locus' },
  { value: 'blank',  label: 'By blank line', hint: 'Paragraphs → one locus each' },
  { value: 'custom', label: 'Custom',        hint: 'Your own delimiter' },
]

export default function PasteLociModal({ open, onClose, onImport }) {
  const [step, setStep] = useState(STEP.CONFIG)
  const [text, setText] = useState('')
  const [primaryMode, setPrimaryMode] = useState('line')
  const [primaryCustom, setPrimaryCustom] = useState('')
  const [secondaryMode, setSecondaryMode] = useState('none')
  const [secondaryDelim, setSecondaryDelim] = useState(' — ')

  const chunks = useMemo(
    () => splitText(text, primaryMode, primaryCustom),
    [text, primaryMode, primaryCustom]
  )

  const loci = useMemo(() => chunks.map((chunk, i) => {
    if (secondaryMode === 'delim' && secondaryDelim.trim()) {
      const parts = chunk.split(secondaryDelim)
      return {
        position: i,
        name: parts[0]?.trim() ?? chunk,
        descriptor: parts[1]?.trim() ?? '',
        notes: parts.slice(2).join(secondaryDelim).trim(),
      }
    }
    return { position: i, name: chunk, descriptor: '', notes: '' }
  }), [chunks, secondaryMode, secondaryDelim])

  const reset = () => {
    setStep(STEP.CONFIG)
    setText('')
    setPrimaryMode('line')
    setPrimaryCustom('')
    setSecondaryMode('none')
    setSecondaryDelim(' — ')
  }

  const handleClose = () => { reset(); onClose() }
  const handleImport = () => { onImport(loci); handleClose() }

  return (
    <Modal open={open} onClose={handleClose} title="Paste loci list" maxWidth="max-w-xl">

      {/* ── Step 0: CONFIG ── */}
      {step === STEP.CONFIG && (
        <div className="flex flex-col gap-4">
          <textarea
            placeholder={
              "Paste loci here, one per line:\n\nFront door\nHallway\nKitchen table\n\n" +
              "Or with descriptors using a separator:\nFront door — heavy oak with brass knocker\nHallway — long narrow corridor"
            }
            value={text}
            onChange={e => setText(e.target.value)}
            rows={10}
            className="bg-slate-900 border border-slate-600 rounded-xl px-3 py-2.5 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500 font-mono text-sm resize-y w-full"
          />

          {/* Primary split */}
          <div>
            <p className="text-sm text-slate-400 mb-2">Split items by</p>
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
                  placeholder="Delimiter (e.g.  ;  |  ---)"
                  value={primaryCustom}
                  onChange={e => setPrimaryCustom(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Secondary split */}
          <div>
            <p className="text-sm text-slate-400 mb-2">Within each locus</p>
            <div className="flex gap-2 flex-wrap">
              {[
                { value: 'none',  label: 'Name only',      hint: 'Whole line → locus name' },
                { value: 'delim', label: 'Split further →', hint: 'Name · Descriptor · Notes' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSecondaryMode(opt.value)}
                  className={`flex flex-col items-start px-3 py-2 rounded-xl text-sm transition-colors border ${
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
            {secondaryMode === 'delim' && (
              <div className="mt-2 flex items-center gap-3 text-sm">
                <Input
                  placeholder="e.g.  —   |   ;"
                  value={secondaryDelim}
                  onChange={e => setSecondaryDelim(e.target.value)}
                  className="w-32"
                />
                <span className="text-slate-500">splits each locus into Name · Descriptor · Notes</span>
              </div>
            )}
          </div>

          {chunks.length > 0 && (
            <p className="text-sm text-slate-400">
              <span className="text-amber-400 font-semibold">{chunks.length}</span> loci detected
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <Button variant="ghost" onClick={handleClose} className="flex-1">Cancel</Button>
            <Button onClick={() => setStep(STEP.PREVIEW)} disabled={!chunks.length} className="flex-1">
              Preview <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 1: PREVIEW ── */}
      {step === STEP.PREVIEW && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-400">
            <span className="text-amber-400 font-semibold">{loci.length}</span> loci ready to add:
          </p>
          <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
            {loci.map((l, i) => (
              <div key={i} className="flex items-start gap-3 bg-slate-700 rounded-xl px-4 py-2.5">
                <span className="text-xs font-bold text-amber-400 w-5 shrink-0 mt-0.5">{i + 1}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-100 truncate">{l.name || '(empty)'}</p>
                  {l.descriptor && <p className="text-xs text-slate-400 mt-0.5 truncate">{l.descriptor}</p>}
                  {l.notes && <p className="text-xs text-slate-500 italic mt-0.5 truncate">{l.notes}</p>}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep(STEP.CONFIG)} className="flex-1">
              <ChevronLeft size={14} /> Back
            </Button>
            <Button onClick={handleImport} className="flex-1">
              Add {loci.length} loci
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
