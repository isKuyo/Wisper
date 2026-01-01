import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { 
  Home, 
  LayoutDashboard, 
  LogOut, 
  Menu, 
  X,
  Shield,
  AlertTriangle,
  Cpu
} from 'lucide-react'
import { useState, useEffect } from 'react'
import api from '../services/api'

export default function Layout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [hubStatus, setHubStatus] = useState(null)

  useEffect(() => {
    loadStatus()
  }, [])

  const loadStatus = async () => {
    try {
      const data = await api.getHubStatus()
      setHubStatus(data.status)
    } catch (err) {
      // Ignore errors
    }
  }

  const hasMaintenance = hubStatus?.maintenanceMode || (hubStatus?.gamesInMaintenance?.length > 0)

  const navigation = [
    { name: 'Home', href: '/', icon: Home },
    { name: 'Executors', href: '/executors', icon: Cpu },
    ...(user ? [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ] : []),
    ...((user?.isAdmin || user?.isOwner) ? [
      { name: 'Admin', href: '/admin', icon: Shield },
    ] : []),
  ]

  const isActive = (href) => {
    if (href === '/') return location.pathname === '/'
    return location.pathname.startsWith(href)
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      {/* Background Glow */}
      <div className="glow-bg"></div>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl" style={{ 
        background: 'rgba(10, 10, 11, 0.8)',
        borderBottom: '1px solid var(--border)'
      }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 transition-colors">
              <span className="text-xl font-bold text-white">wisper<span className="text-accent">hub</span></span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive(item.href)
                      ? 'text-white'
                      : 'text-[#a1a1aa] hover:text-white'
                  }`}
                  style={isActive(item.href) ? { background: 'var(--bg-tertiary)' } : {}}
                >
                  <item.icon className="w-4 h-4" />
                  {item.name}
                </Link>
              ))}
            </nav>

            {/* Right Side - Status + User Menu */}
            <div className="flex items-center gap-4">
              {/* Status Indicator */}
              <Link
                to="/status"
                className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${
                  hasMaintenance
                    ? 'text-orange-400 bg-orange-500/10 hover:bg-orange-500/20'
                    : 'text-green-400 bg-green-500/10 hover:bg-green-500/20'
                }`}
              >
                {hasMaintenance ? (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Maintenance</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                    <span>Online</span>
                  </>
                )}
              </Link>

              {/* User Menu */}
              {user ? (
                <div className="flex items-center gap-3">
                  <div className="hidden sm:flex items-center gap-2">
                    {user.avatar ? (
                      <img
                        src={`https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png`}
                        alt={user.username}
                        className="w-9 h-9 rounded-full"
                        style={{ border: '2px solid var(--accent)' }}
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', border: '2px solid var(--accent)' }}>
                        <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{user.username[0]}</span>
                      </div>
                    )}
                    <span className="text-sm font-medium">{user.username}</span>
                    {user.isOwner && (
                      <span className="px-2 py-0.5 text-xs bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded-md">Owner</span>
                    )}
                    {user.isAdmin && !user.isOwner && (
                      <span className="px-2 py-0.5 text-xs rounded-md" style={{ background: 'rgba(152, 175, 211, 0.1)', color: 'var(--accent)', border: '1px solid rgba(152, 175, 211, 0.2)' }}>Admin</span>
                    )}
                  </div>
                  <button
                    onClick={logout}
                    className="p-2 rounded-lg transition-all"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseOver={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-tertiary)' }}
                    onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}
                    title="Logout"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <Link to="/login" className="btn btn-primary">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.36-.698.772-1.362 1.225-1.993a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.12-.098.246-.198.373-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                  Login with Discord
                </Link>
              )}

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden" style={{ borderTop: '1px solid var(--border)' }}>
            <nav className="px-4 py-3 space-y-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive(item.href)
                      ? 'text-white'
                      : 'text-[#a1a1aa] hover:text-white'
                  }`}
                  style={isActive(item.href) ? { background: 'var(--bg-tertiary)' } : {}}
                >
                  <item.icon className="w-4 h-4" />
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 pt-24 relative z-10">
        <Outlet />
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              © 2026 Wisper Hub. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
