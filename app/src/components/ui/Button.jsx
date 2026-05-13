const variants = {
  primary:   'bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold',
  secondary: 'bg-slate-700 hover:bg-slate-600 text-slate-100',
  ghost:     'bg-transparent hover:bg-slate-800 text-slate-300',
  danger:    'bg-red-800 hover:bg-red-700 text-white',
  outline:   'border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-slate-100',
}

const sizes = {
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-4 py-2 text-sm rounded-xl',
  lg: 'px-6 py-3 text-base rounded-xl',
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  ...props
}) {
  return (
    <button
      {...props}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center gap-2 transition-colors
        disabled:opacity-40 disabled:cursor-not-allowed
        ${variants[variant]} ${sizes[size]} ${className}
      `}
    >
      {children}
    </button>
  )
}
