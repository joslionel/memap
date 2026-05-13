import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Building2, BookOpen, Map, LogOut } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const navItems = [
  { to: '/',         label: 'Home',     Icon: LayoutDashboard },
  { to: '/palaces',  label: 'Palaces',  Icon: Building2 },
  { to: '/sets',     label: 'Sets',     Icon: BookOpen },
  { to: '/journeys', label: 'Journeys', Icon: Map },
]

function NavItem({ to, label, Icon, sidebar }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        sidebar
          ? `flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
              isActive
                ? 'bg-amber-500/20 text-amber-400'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            }`
          : `flex flex-col items-center gap-1 py-2 px-3 transition-colors ${
              isActive ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'
            }`
      }
    >
      <Icon size={sidebar ? 20 : 22} />
      <span className={sidebar ? 'text-sm font-medium' : 'text-xs'}>{label}</span>
    </NavLink>
  )
}

export default function Layout() {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex min-h-dvh bg-slate-900">
      {/* Sidebar — desktop only */}
      <aside className="hidden md:flex flex-col w-56 border-r border-slate-800 p-4 shrink-0">
        <div className="mb-8 px-4 pt-2">
          <span className="text-amber-400 font-bold text-lg tracking-tight">🏛 MemPalace</span>
        </div>
        <nav className="flex flex-col gap-1 flex-1">
          {navItems.map((item) => (
            <NavItem key={item.to} {...item} sidebar />
          ))}
        </nav>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors text-sm"
        >
          <LogOut size={18} />
          Sign out
        </button>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <Outlet />
        </main>
      </div>

      {/* Bottom nav — mobile only */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 flex justify-around px-2 z-40">
        {navItems.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>
    </div>
  )
}
