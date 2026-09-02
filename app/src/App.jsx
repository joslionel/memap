import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Spinner from './components/ui/Spinner'

import Login from './pages/auth/Login'
import Dashboard from './pages/Dashboard'
import PalaceList from './pages/palaces/PalaceList'
import PalaceEditor from './pages/palaces/PalaceEditor'
import PalaceImport from './pages/palaces/PalaceImport'
import SetList from './pages/sets/SetList'
import SetEditor from './pages/sets/SetEditor'
import ImportWizard from './pages/sets/ImportWizard'
import JourneyList from './pages/journeys/JourneyList'
import JourneyEditor from './pages/journeys/JourneyEditor'
import ReviewSession from './pages/practice/ReviewSession'
import PracticeSession from './pages/practice/PracticeSession'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-slate-900">
      <Spinner size="lg" />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Full-screen practice session — no nav chrome (focused recall test) */}
      <Route path="/journeys/:id/practice" element={
        <ProtectedRoute><PracticeSession /></ProtectedRoute>
      } />

      {/* Main app with nav layout */}
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/palaces" element={<PalaceList />} />
        <Route path="/palaces/import" element={<PalaceImport />} />
        <Route path="/palaces/:id" element={<PalaceEditor />} />
        <Route path="/sets" element={<SetList />} />
        <Route path="/sets/new" element={<SetEditor />} />
        <Route path="/sets/import" element={<ImportWizard />} />
        <Route path="/sets/:id" element={<SetEditor />} />
        <Route path="/journeys" element={<JourneyList />} />
        <Route path="/journeys/new" element={<JourneyEditor />} />
        <Route path="/journeys/:id" element={<JourneyEditor />} />
        <Route path="/journeys/:id/review" element={<ReviewSession />} />
      </Route>
    </Routes>
  )
}
