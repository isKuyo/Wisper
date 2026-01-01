import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import api from '../services/api'
import { 
  Users, 
  Code, 
  CheckSquare, 
  Settings, 
  FileText,
  ArrowRight,
  TrendingUp,
  Key,
  Gamepad2,
  AlertTriangle
} from 'lucide-react'

export default function AdminPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const data = await api.getStats()
      setStats(data.stats)
    } catch (err) {
      console.error('Failed to load stats:', err)
    } finally {
      setLoading(false)
    }
  }

  const adminLinks = [
    { name: 'Users', href: '/admin/users', icon: Users, description: 'Manage users and their keys' },
    { name: 'Scripts', href: '/admin/scripts', icon: Code, description: 'Manage game scripts' },
    { name: 'Checkpoints', href: '/admin/checkpoints', icon: CheckSquare, description: 'Configure checkpoints' },
    { name: 'Loader Errors', href: '/admin/loader-errors', icon: AlertTriangle, description: 'View loader execution errors' },
    { name: 'Settings', href: '/admin/settings', icon: Settings, description: 'System settings' },
    { name: 'Audit Logs', href: '/admin/logs', icon: FileText, description: 'View activity logs' }
  ]

  const statCards = stats ? [
    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'primary' },
    { label: 'Active Keys', value: stats.activeKeys, icon: Key, color: 'green' },
    { label: 'Games', value: stats.totalScripts, icon: Gamepad2, color: 'purple' },
    { label: 'Logins (24h)', value: stats.recentLogins, icon: TrendingUp, color: 'yellow' }
  ] : []

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold text-white mb-2">Admin Panel</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Welcome back, {user?.username}
          {user?.isOwner && <span className="badge badge-warning ml-2">Owner</span>}
        </p>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="panel p-5 animate-pulse">
              <div className="h-20 rounded" style={{ background: 'var(--bg-tertiary)' }}></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, index) => (
            <div key={index} className="panel p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
                  <p className="text-3xl font-bold mt-1 text-accent">{stat.value}</p>
                </div>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(152, 175, 211, 0.15)' }}>
                  <stat.icon className="w-6 h-6 text-accent" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Links */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-5">Quick Access</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {adminLinks.map((link) => (
            <Link
              key={link.name}
              to={link.href}
              className="panel p-5 hover:border-[#3f3f46] transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center transition-colors" style={{ background: 'rgba(152, 175, 211, 0.1)' }}>
                  <link.icon className="w-6 h-6 text-accent" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-white group-hover:text-accent transition-colors">
                    {link.name}
                  </h3>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{link.description}</p>
                </div>
                <ArrowRight className="w-5 h-5 group-hover:text-accent transition-colors" style={{ color: 'var(--text-muted)' }} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
