import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getJourneys } from '../lib/db'
import { useAuth } from '../contexts/AuthContext'
import { loadTutorialStash, clearTutorialStash, materializeTutorial } from '../lib/tutorial'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import { Map, ChevronRight, BookOpen, Brain, Sparkles } from 'lucide-react'

function JourneyCard({ journey }) {
  const dueCount = journey.due_count ?? 0

  return (
    <div className="bg-slate-800 rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-100 truncate">{journey.name}</h3>
          <p className="text-sm text-slate-400 mt-0.5">
            {journey.memory_sets?.icon ?? '📚'} {journey.memory_sets?.title ?? '—'}
            {journey.palaces?.name ? ` · ${journey.palaces.name}` : ''}
          </p>
        </div>
        {dueCount > 0 && (
          <Badge colour="amber">{dueCount} due</Badge>
        )}
      </div>

      <div className="flex gap-2">
        <Link to={`/journeys/${journey.id}/review`} className="flex-1">
          <Button variant="secondary" size="sm" className="w-full gap-1.5">
            <BookOpen size={14} /> Review
          </Button>
        </Link>
        <Link to={`/journeys/${journey.id}/practice`} className="flex-1">
          <Button size="sm" className="w-full gap-1.5">
            <Brain size={14} /> Practice
          </Button>
        </Link>
        <Link to={`/journeys/${journey.id}`}>
          <Button variant="ghost" size="sm">
            <ChevronRight size={16} />
          </Button>
        </Link>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const [journeys, setJourneys] = useState([])
  const [loading, setLoading] = useState(true)
  const [welcome, setWelcome] = useState(null) // { journeyId } once the tutorial palace is built
  const materialising = useRef(false)

  useEffect(() => {
    getJourneys().then(({ data, error }) => {
      if (!error) setJourneys(data ?? [])
      setLoading(false)
    })
  }, [])

  // First sign-in after the walkthrough — turn the stashed loci + imagery into a real journey.
  useEffect(() => {
    if (!user || materialising.current || !loadTutorialStash()) return
    materialising.current = true
    materializeTutorial(user.id)
      .then((res) => {
        if (res) {
          setWelcome(res)
          getJourneys().then(({ data }) => setJourneys(data ?? []))
        }
      })
      .catch((err) => {
        console.error('Could not build tutorial palace', err)
        clearTutorialStash()
      })
  }, [user])

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100">{greeting()}</h1>
        <p className="text-slate-400 text-sm mt-1">{user?.email}</p>
      </div>

      {welcome && (
        <div className="mb-6 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5">
          <p className="flex items-center gap-2 font-semibold text-amber-300">
            <Sparkles size={16} /> Your first palace is ready
          </p>
          <p className="text-sm text-slate-300 mt-1">
            The walk through your home is saved as <strong>My First Journey</strong>, with your ten
            objects and imagery. Review it now to lock it in — then come back tomorrow.
          </p>
          <Link to={`/journeys/${welcome.journeyId}/review`}>
            <Button size="sm" className="mt-3"><BookOpen size={14} /> Review it now</Button>
          </Link>
        </div>
      )}

      {/* Journeys */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-200">Your journeys</h2>
        <Link to="/journeys">
          <Button variant="ghost" size="sm" className="text-amber-400">
            View all <ChevronRight size={14} />
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : journeys.length === 0 ? (
        <EmptyState
          icon={<Map size={40} className="text-slate-600" />}
          title="No journeys yet"
          description="Create a memory palace and a set of items, then link them in a journey."
          action={
            <Link to="/journeys/new">
              <Button>Create your first journey</Button>
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {journeys.map((j) => (
            <JourneyCard key={j.id} journey={j} />
          ))}
        </div>
      )}

      {/* Quick links */}
      {journeys.length > 0 && (
        <div className="mt-8 grid grid-cols-3 gap-3">
          {[
            { to: '/palaces', label: 'Palaces', icon: '🏛' },
            { to: '/sets',    label: 'Sets',    icon: '📚' },
            { to: '/journeys/new', label: 'New journey', icon: '✨' },
          ].map(({ to, label, icon }) => (
            <Link key={to} to={to}>
              <div className="bg-slate-800 hover:bg-slate-700 rounded-2xl p-4 text-center transition-colors">
                <div className="text-2xl mb-1">{icon}</div>
                <p className="text-xs text-slate-400">{label}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
