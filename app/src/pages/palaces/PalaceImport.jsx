import { useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { parsePalaceFile } from '../../lib/palaceImport'
import { createPalace, upsertLoci } from '../../lib/db'
import { useAuth } from '../../contexts/AuthContext'
import Button from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import Spinner from '../../components/ui/Spinner'
import { ArrowLeft, Upload, ChevronRight, Check, AlertCircle, MapPin } from 'lucide-react'

const STEP = { UPLOAD: 0, REVIEW: 1, DONE: 2 }

export default function PalaceImport() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const fileRef = useRef()

  const [step, setStep] = useState(STEP.UPLOAD)
  const [error, setError] = useState('')
  const [parsed, setParsed] = useState(null)    // { name, description, loci }
  const [palaceName, setPalaceName] = useState('')
  const [palaceDesc, setPalaceDesc] = useState('')
  const [importing, setImporting] = useState(false)

  const handleFile = async (file) => {
    setError('')
    try {
      const text = await file.text()
      const result = parsePalaceFile(text, file.name)

      if (!result.loci.length) {
        throw new Error('No loci found in this file. Check the format and try again.')
      }

      // Sort by position
      result.loci.sort((a, b) => a.position - b.position)
      // Re-number positions sequentially (1, 2, 3…)
      result.loci = result.loci.map((l, i) => ({ ...l, position: i }))

      setParsed(result)
      setPalaceName(result.name)
      setPalaceDesc(result.description)
      setStep(STEP.REVIEW)
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
    if (!palaceName.trim()) return
    setImporting(true)

    const { data: palace, error: palaceErr } = await createPalace({
      user_id: user.id,
      name: palaceName.trim(),
      description: palaceDesc.trim(),
    })

    if (palaceErr || !palace) {
      setError(palaceErr?.message ?? 'Failed to create palace')
      setImporting(false)
      return
    }

    const lociToInsert = parsed.loci.map((l) => ({
      palace_id: palace.id,
      position: l.position,
      name: l.name,
      descriptor: l.descriptor ?? '',
      notes: l.notes ?? '',
      ...(l.coords ? { coords: l.coords } : {}),
    }))

    await upsertLoci(lociToInsert)

    setImporting(false)
    setStep(STEP.DONE)
    setTimeout(() => navigate(`/palaces/${palace.id}`), 1500)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/palaces"><Button variant="ghost" size="sm"><ArrowLeft size={16} /></Button></Link>
        <h1 className="text-2xl font-bold text-slate-100">Import palace</h1>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8 text-sm">
        {['Upload', 'Review & import'].map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
              ${step === i ? 'bg-amber-500 text-slate-900' : step > i ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
              {step > i ? <Check size={12} /> : i + 1}
            </div>
            <span className={step >= i ? 'text-slate-200' : 'text-slate-500'}>{label}</span>
            {i < 1 && <ChevronRight size={14} className="text-slate-600" />}
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
        <div className="flex flex-col gap-6">
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-slate-600 hover:border-amber-500 rounded-2xl p-12 text-center cursor-pointer transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={36} className="mx-auto text-slate-500 mb-4" />
            <p className="text-slate-300 font-medium mb-1">Drop a file here</p>
            <p className="text-slate-500 text-sm">or click to select · JSON or CSV</p>
            <input
              ref={fileRef}
              type="file"
              accept=".json,.csv"
              className="hidden"
              onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
            />
          </div>

          {/* Format guide */}
          <div className="bg-slate-800 rounded-2xl p-5 text-sm text-slate-400 flex flex-col gap-4">
            <p className="font-medium text-slate-300">Supported formats</p>

            <div>
              <p className="text-amber-400 font-medium mb-1">Palace JSON</p>
              <pre className="text-xs bg-slate-900 rounded-lg p-3 overflow-x-auto text-slate-400">{`{
  "name": "My palace",
  "description": "Optional",
  "loci": [
    { "position": 1, "name": "Front door", "descriptor": "…" },
    { "position": 2, "name": "Hallway", "descriptor": "…" }
  ]
}`}</pre>
            </div>

            <div>
              <p className="text-amber-400 font-medium mb-1">CSV</p>
              <pre className="text-xs bg-slate-900 rounded-lg p-3 overflow-x-auto text-slate-400">{`position,name,descriptor,notes
1,Front door,Heavy oak door,
2,Hallway,Long narrow corridor,`}</pre>
            </div>

            <div>
              <p className="text-amber-400 font-medium mb-1">Item-embedded (your existing loci files)</p>
              <p className="text-xs text-slate-500">
                Works with files like <code className="text-slate-400">roman_emperors_memory_palace_loci.json</code> —
                locus data is extracted from the <code className="text-slate-400">userEdits.locus</code> and <code className="text-slate-400">locusNumber</code> fields.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Review */}
      {step === STEP.REVIEW && parsed && (
        <div className="flex flex-col gap-6">
          {/* Palace metadata */}
          <div className="bg-slate-800 rounded-2xl p-5 flex flex-col gap-4">
            <h2 className="font-semibold text-slate-200">Palace details</h2>
            <Input
              label="Palace name *"
              value={palaceName}
              onChange={(e) => setPalaceName(e.target.value)}
              placeholder="Name for this palace"
            />
            <Input
              label="Description"
              value={palaceDesc}
              onChange={(e) => setPalaceDesc(e.target.value)}
              placeholder="Optional description"
            />
          </div>

          {/* Loci preview */}
          <div className="bg-slate-800 rounded-2xl p-5">
            <h2 className="font-semibold text-slate-200 mb-4">
              {parsed.loci.length} loci detected
            </h2>

            <div className="flex flex-col gap-2 max-h-96 overflow-y-auto pr-1">
              {parsed.loci.map((locus, i) => (
                <div key={i} className="flex items-start gap-3 bg-slate-700 rounded-xl px-4 py-3">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-100">{locus.name}</p>
                    {locus.descriptor && (
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{locus.descriptor}</p>
                    )}
                    {locus.coords && (
                      <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-1">
                        <MapPin size={10} />
                        {locus.coords.lat?.toFixed(4)}, {locus.coords.lng?.toFixed(4)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => { setStep(STEP.UPLOAD); setParsed(null) }} className="flex-1">
              Back
            </Button>
            <Button onClick={handleImport} disabled={importing || !palaceName.trim()} className="flex-1">
              {importing
                ? <><Spinner size="sm" /> Importing…</>
                : `Import ${parsed.loci.length} loci`}
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Done */}
      {step === STEP.DONE && (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🏛</div>
          <h2 className="text-xl font-semibold text-slate-100 mb-2">Palace imported!</h2>
          <p className="text-slate-400">Redirecting to the palace editor…</p>
        </div>
      )}
    </div>
  )
}
