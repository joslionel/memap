import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { sampleObjects, saveTutorialStash } from '../../lib/tutorial'
import { SortableList } from '../../components/SortableList'
import Button from '../../components/ui/Button'
import { Input, Textarea } from '../../components/ui/Input'
import { ArrowLeft, ArrowRight, Plus, Trash2, Sparkles } from 'lucide-react'

const STEPS = ['Challenge', 'Your home', 'Your palace', 'Imagery', 'Recall', 'Sign up']

const ROOM_PROMPTS = [
  'Imagine standing at your front door. Step inside. What is the first room you are in — or that you can see straight ahead?',
  'Walk to the first doorway from there. What room does it open into?',
  'Through the next doorway — what room now?',
  'One last doorway. What room is this?',
]

const WALLS = ['left wall', 'back wall', 'right wall']

const IMAGERY_EXAMPLE =
  'At your front door is a sausage — a sentient hot dog with little arms and legs, ' +
  'smearing a big red X across the door with a bottle of ketchup.'

function buildLoci(rooms) {
  const out = [{ id: 'l-door', name: 'Front door' }]
  rooms.forEach((room, ri) => {
    const r = room.trim() || `Room ${ri + 1}`
    WALLS.forEach((w, wi) => out.push({ id: `l-${ri}-${wi}`, name: `${r} — ${w}` }))
  })
  return out
}

function Progress({ step }) {
  return (
    <div className="flex items-center gap-1.5">
      {STEPS.map((label, i) => (
        <div
          key={label}
          title={label}
          className={`h-1.5 rounded-full transition-all ${
            i === step ? 'w-6 bg-amber-400' : i < step ? 'w-3 bg-amber-400/50' : 'w-3 bg-slate-700'
          }`}
        />
      ))}
    </div>
  )
}

function Shell({ step, onSkip, children }) {
  return (
    <div className="min-h-dvh bg-slate-900 flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 shrink-0">
        <span className="text-amber-400 font-bold tracking-tight">🏛 Memory Palace</span>
        <button onClick={onSkip} className="text-sm text-slate-400 hover:text-slate-200 transition-colors">
          Sign in →
        </button>
      </div>
      <div className="px-5 shrink-0"><Progress step={step} /></div>
      <div className="flex-1 flex items-start justify-center px-5 pt-6 pb-12 sm:pt-10">
        <div className="w-full max-w-lg">{children}</div>
      </div>
    </div>
  )
}

function NavRow({ onBack, onNext, nextLabel = 'Next', nextDisabled = false, hint }) {
  return (
    <div className="mt-6">
      {hint && <p className="text-xs text-slate-500 mb-2 text-center">{hint}</p>}
      <div className="flex items-center gap-3">
        {onBack && (
          <Button variant="ghost" onClick={onBack} className="shrink-0">
            <ArrowLeft size={16} /> Back
          </Button>
        )}
        <Button onClick={onNext} disabled={nextDisabled} className="flex-1">
          {nextLabel} <ArrowRight size={16} />
        </Button>
      </div>
    </div>
  )
}

export default function Tutorial({ onSkipToSignIn }) {
  const [step, setStep] = useState(0)
  const [objects] = useState(() => sampleObjects(10))

  const [roomIdx, setRoomIdx] = useState(0)
  const [rooms, setRooms] = useState(['', '', '', ''])
  const [loci, setLoci] = useState([])

  const [pairIdx, setPairIdx] = useState(0)
  const [imagery, setImagery] = useState([])

  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const pairCount = Math.min(10, loci.length)

  // ── Step 1: rooms ─────────────────────────────────────────────────────────
  const setRoom = (v) => setRooms((r) => r.map((x, i) => (i === roomIdx ? v : x)))
  const roomsNext = () => {
    if (roomIdx < rooms.length - 1) return setRoomIdx(roomIdx + 1)
    setLoci((prev) => (prev.length ? prev : buildLoci(rooms)))
    setStep(2)
  }
  const roomsBack = () => (roomIdx > 0 ? setRoomIdx(roomIdx - 1) : setStep(0))

  // ── Step 2: loci list ─────────────────────────────────────────────────────
  const renameLocus = (id, name) => setLoci((ls) => ls.map((l) => (l.id === id ? { ...l, name } : l)))
  const removeLocus = (id) => setLoci((ls) => ls.filter((l) => l.id !== id))
  const addLocus = () => setLoci((ls) => [...ls, { id: `l-extra-${Date.now()}`, name: '' }])

  // ── Step 3: imagery ───────────────────────────────────────────────────────
  const setImageryAt = (i, v) => setImagery((arr) => { const c = [...arr]; c[i] = v; return c })

  // ── Step 5: sign up ───────────────────────────────────────────────────────
  const handleSignup = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    saveTutorialStash({
      loci: loci.map((l) => ({ name: l.name.trim() || 'Locus' })),
      pairs: Array.from({ length: pairCount }, (_, i) => ({
        locusIndex: i,
        object: objects[i],
        imagery: (imagery[i] ?? '').trim(),
      })),
    })
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
    })
    setLoading(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (step === 0) {
    return (
      <Shell step={0} onSkip={onSkipToSignIn}>
        <h1 className="text-2xl font-bold text-slate-100 mb-3">A quick challenge</h1>
        <p className="text-slate-400 leading-relaxed mb-5">
          Here are ten random objects. Right now, remembering all ten — in order — sounds hard.
          In about three minutes you will have them locked in, using nothing but a walk through
          your own home. Let&apos;s build your first memory palace.
        </p>
        <div className="flex flex-wrap gap-2 mb-2">
          {objects.map((o, i) => (
            <span key={o} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200">
              <span className="text-slate-500 mr-1.5">{i + 1}</span>{o}
            </span>
          ))}
        </div>
        <NavRow onNext={() => setStep(1)} nextLabel="I'm ready" />
        <button onClick={onSkipToSignIn} className="mt-4 w-full text-center text-sm text-slate-500 hover:text-slate-300 transition-colors">
          I already have an account
        </button>
      </Shell>
    )
  }

  if (step === 1) {
    return (
      <Shell step={1} onSkip={onSkipToSignIn}>
        <p className="text-xs text-amber-400 uppercase tracking-wider font-semibold mb-2">
          Room {roomIdx + 1} of {rooms.length}
        </p>
        <h2 className="text-xl font-semibold text-slate-100 mb-4 leading-snug">{ROOM_PROMPTS[roomIdx]}</h2>
        <Input
          autoFocus
          placeholder="e.g. the kitchen"
          value={rooms[roomIdx]}
          onChange={(e) => setRoom(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && rooms[roomIdx].trim() && roomsNext()}
        />
        <p className="text-xs text-slate-500 mt-3">
          Don&apos;t overthink it — the real layout of your home is exactly what makes this stick.
        </p>
        <NavRow
          onBack={roomsBack}
          onNext={roomsNext}
          nextDisabled={!rooms[roomIdx].trim()}
          nextLabel={roomIdx === rooms.length - 1 ? 'Build my palace' : 'Next'}
        />
      </Shell>
    )
  }

  if (step === 2) {
    return (
      <Shell step={2} onSkip={onSkipToSignIn}>
        <h2 className="text-xl font-semibold text-slate-100 mb-2">Your palace, one stop at a time</h2>
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          Your front door is stop 1. Each room becomes three stops — its left wall, back wall and
          right wall — so a quick walk gives you plenty of places. Drag to reorder, edit any label,
          add or remove stops. Keep going until the walk feels natural. You need at least 10.
        </p>

        <SortableList
          items={loci}
          onReorder={setLoci}
          renderItem={(locus) => {
            const n = loci.indexOf(locus) + 1
            return (
              <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2">
                <span className="text-xs font-bold text-amber-400 w-5 text-center shrink-0">{n}</span>
                <input
                  value={locus.name}
                  onChange={(e) => renameLocus(locus.id, e.target.value)}
                  placeholder="Locus label"
                  className="flex-1 min-w-0 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
                />
                <button
                  onClick={() => removeLocus(locus.id)}
                  className="p-1 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-900/40 transition-colors shrink-0"
                  aria-label="Remove locus"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )
          }}
        />

        <button
          onClick={addLocus}
          className="mt-3 flex items-center gap-1.5 text-sm text-amber-400 hover:text-amber-300 transition-colors"
        >
          <Plus size={14} /> Add a stop
        </button>

        <NavRow
          onBack={() => setStep(1)}
          onNext={() => { setPairIdx(0); setStep(3) }}
          nextDisabled={loci.length < 10}
          hint={loci.length < 10 ? `Add ${10 - loci.length} more stop${10 - loci.length === 1 ? '' : 's'} to continue` : `${loci.length} stops — we'll use the first 10`}
          nextLabel="Place the objects"
        />
      </Shell>
    )
  }

  if (step === 3) {
    const locus = loci[pairIdx]
    const object = objects[pairIdx]
    const last = pairIdx === pairCount - 1
    return (
      <Shell step={3} onSkip={onSkipToSignIn}>
        <p className="text-xs text-amber-400 uppercase tracking-wider font-semibold mb-3">
          Stop {pairIdx + 1} of {pairCount}
        </p>

        <div className="bg-slate-800 rounded-2xl p-5 mb-4">
          <p className="text-lg font-bold text-slate-100">{locus?.name}</p>
          <div className="flex items-center gap-2 my-2 text-slate-500 text-sm">
            <div className="h-px flex-1 bg-slate-700" /> put here <div className="h-px flex-1 bg-slate-700" />
          </div>
          <p className="text-lg font-bold text-amber-300">{object}</p>
        </div>

        <Textarea
          autoFocus
          rows={4}
          label="Imagery — make it vivid, absurd, moving"
          placeholder="What do you see happening here?"
          value={imagery[pairIdx] ?? ''}
          onChange={(e) => setImageryAt(pairIdx, e.target.value)}
        />
        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
          <Sparkles size={11} className="inline mr-1 text-amber-400" />
          Example — <span className="italic">front door</span> + <span className="italic">sausage</span>: “{IMAGERY_EXAMPLE}”
        </p>

        <NavRow
          onBack={() => (pairIdx > 0 ? setPairIdx(pairIdx - 1) : setStep(2))}
          onNext={() => (last ? setStep(4) : setPairIdx(pairIdx + 1))}
          nextLabel={last ? 'Test myself' : 'Next stop'}
        />
      </Shell>
    )
  }

  if (step === 4) {
    return (
      <Shell step={4} onSkip={onSkipToSignIn}>
        <h2 className="text-xl font-semibold text-slate-100 mb-2">Now — recall</h2>
        <p className="text-slate-400 text-sm mb-5">
          Walk your palace in your head. Answer, then reveal. Don&apos;t worry about getting them all.
        </p>

        <div className="flex flex-col gap-3">
          <RecallCard
            question={`What is waiting at "${loci[2]?.name}"?`}
            answer={objects[2]}
            imagery={imagery[2]}
          />
          <RecallCard
            question={`What was object #6 on your list?`}
            answer={objects[5]}
            imagery={imagery[5]}
          />
          <RecallCard
            question={`In your list, what comes right before "${objects[4]}"?`}
            answer={objects[3]}
            imagery={imagery[3]}
          />
          <RecallCard
            question={`What is at "${loci[7]?.name}"?`}
            answer={objects[7]}
            imagery={imagery[7]}
          />
        </div>

        <NavRow
          onBack={() => { setPairIdx(pairCount - 1); setStep(3) }}
          onNext={() => setStep(5)}
          nextLabel="Save my palace"
        />
      </Shell>
    )
  }

  // step 5 — sign up
  return (
    <Shell step={5} onSkip={onSkipToSignIn}>
      {sent ? (
        <div className="bg-slate-800 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-4">✉️</div>
          <h2 className="text-lg font-semibold text-slate-100 mb-2">Check your email</h2>
          <p className="text-slate-400 text-sm">
            A magic link is on its way to <strong className="text-slate-200">{email}</strong>.
            Click it and your palace — loci, objects and imagery — will be waiting, ready to review.
          </p>
          <button onClick={() => setSent(false)} className="mt-6 text-sm text-slate-500 hover:text-slate-300 transition-colors">
            Use a different email
          </button>
        </div>
      ) : (
        <>
          <h2 className="text-xl font-semibold text-slate-100 mb-2">Keep this palace</h2>
          <p className="text-slate-400 text-sm mb-5">
            You just memorised ten random things with a three-minute walk. Sign up (no password —
            just a magic link) and we&apos;ll save this as your first journey, then remind you to
            review it so it sticks for good.
          </p>
          <form onSubmit={handleSignup} className="bg-slate-800 rounded-2xl p-6 flex flex-col gap-4">
            <Input
              label="Email address"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <Button type="submit" disabled={loading} size="lg" className="w-full">
              {loading ? 'Sending…' : 'Send magic link'}
            </Button>
          </form>
          <button onClick={() => setStep(4)} className="mt-4 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors">
            <ArrowLeft size={14} /> Back
          </button>
        </>
      )}
    </Shell>
  )
}

function RecallCard({ question, answer, imagery }) {
  const [guess, setGuess] = useState('')
  const [revealed, setRevealed] = useState(false)
  const correct = revealed && guess.trim().toLowerCase() === (answer ?? '').toLowerCase()

  return (
    <div className="bg-slate-800 rounded-xl p-4">
      <p className="text-sm text-slate-200 mb-3">{question}</p>
      <div className="flex gap-2">
        <input
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          placeholder="Your answer"
          className="flex-1 min-w-0 bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
        />
        <button
          onClick={() => setRevealed(true)}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors shrink-0"
        >
          Reveal
        </button>
      </div>
      {revealed && (
        <div className="mt-3 text-sm">
          <p className={correct ? 'text-emerald-400' : 'text-slate-300'}>
            {correct ? '✓ ' : ''}It&apos;s <strong>{answer}</strong>
          </p>
          {imagery?.trim() && <p className="text-xs text-slate-500 italic mt-1">“{imagery.trim()}”</p>}
        </div>
      )}
    </div>
  )
}
