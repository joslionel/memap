export function Input({ label, error, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm text-slate-400">{label}</label>}
      <input
        {...props}
        className={`
          bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-slate-100
          placeholder:text-slate-500 focus:outline-none focus:border-amber-500
          transition-colors ${className}
        `}
      />
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  )
}

export function Textarea({ label, error, className = '', rows = 4, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm text-slate-400">{label}</label>}
      <textarea
        {...props}
        rows={rows}
        className={`
          bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-slate-100
          placeholder:text-slate-500 focus:outline-none focus:border-amber-500
          transition-colors resize-y ${className}
        `}
      />
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  )
}

export function Select({ label, error, children, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm text-slate-400">{label}</label>}
      <select
        {...props}
        className={`
          bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-slate-100
          focus:outline-none focus:border-amber-500 transition-colors ${className}
        `}
      >
        {children}
      </select>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  )
}
