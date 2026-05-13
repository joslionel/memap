import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Button from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'

export default function Login() {
  const { user } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (user) return <Navigate to="/" replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
  }

  return (
    <div className="min-h-dvh bg-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-6xl mb-4">🏛</div>
          <h1 className="text-3xl font-bold text-slate-100 mb-2">Memory Palace</h1>
          <p className="text-slate-400 text-sm">Build and rehearse journeys through your mind</p>
        </div>

        {sent ? (
          <div className="bg-slate-800 rounded-2xl p-8 text-center">
            <div className="text-4xl mb-4">✉️</div>
            <h2 className="text-lg font-semibold text-slate-100 mb-2">Check your email</h2>
            <p className="text-slate-400 text-sm">
              A magic link has been sent to <strong className="text-slate-200">{email}</strong>.
              Click it to sign in — no password needed.
            </p>
            <button
              onClick={() => setSent(false)}
              className="mt-6 text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-slate-800 rounded-2xl p-8 flex flex-col gap-4">
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
            <Button type="submit" disabled={loading} size="lg" className="w-full mt-2">
              {loading ? 'Sending…' : 'Send magic link'}
            </Button>
            <p className="text-xs text-slate-500 text-center">
              No account needed — just enter your email and we'll send a link.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
