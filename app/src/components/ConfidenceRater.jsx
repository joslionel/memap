const LEVELS = [
  { score: 1, label: 'Blank',   colour: 'bg-red-900 hover:bg-red-800 border-red-700' },
  { score: 2, label: 'Fuzzy',   colour: 'bg-orange-900 hover:bg-orange-800 border-orange-700' },
  { score: 3, label: 'OK',      colour: 'bg-yellow-900 hover:bg-yellow-800 border-yellow-700' },
  { score: 4, label: 'Good',    colour: 'bg-green-900 hover:bg-green-800 border-green-700' },
  { score: 5, label: 'Perfect', colour: 'bg-emerald-800 hover:bg-emerald-700 border-emerald-600' },
]

export default function ConfidenceRater({ value, onChange }) {
  return (
    <div className="flex gap-2">
      {LEVELS.map(({ score, label, colour }) => (
        <button
          key={score}
          onClick={() => onChange(score)}
          className={`
            flex-1 py-3 rounded-xl border transition-all text-center
            ${colour}
            ${value === score ? 'ring-2 ring-amber-400 scale-105' : 'opacity-80'}
          `}
        >
          <span className="block text-xl font-bold text-white">{score}</span>
          <span className="block text-xs text-slate-300 mt-0.5">{label}</span>
        </button>
      ))}
    </div>
  )
}
