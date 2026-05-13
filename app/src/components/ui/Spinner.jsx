const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' }

export default function Spinner({ size = 'md' }) {
  return (
    <div
      className={`${sizes[size]} border-2 border-slate-600 border-t-amber-500 rounded-full animate-spin`}
    />
  )
}
