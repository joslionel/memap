const colours = {
  amber:  'bg-amber-500/20 text-amber-300',
  green:  'bg-green-500/20 text-green-300',
  red:    'bg-red-500/20 text-red-300',
  blue:   'bg-blue-500/20 text-blue-300',
  slate:  'bg-slate-700 text-slate-300',
  purple: 'bg-purple-500/20 text-purple-300',
}

export default function Badge({ children, colour = 'slate' }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colours[colour]}`}>
      {children}
    </span>
  )
}
