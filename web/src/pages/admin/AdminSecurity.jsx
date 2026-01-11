import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import api from '../../services/api'
import { 
  Shield, 
  AlertTriangle, 
  Ban, 
  UserX, 
  Eye, 
  Trash2, 
  RefreshCw,
  Search,
  Filter,
  Clock,
  Gamepad2,
  User,
  Key,
  Terminal,
  CheckCircle,
  XCircle
} from 'lucide-react'

const ACTION_LABELS = {
  'DUMP_ATTEMPT': { label: 'Dump Attempt', color: 'red', icon: AlertTriangle },
  'TAMPER_ATTEMPT': { label: 'Tamper Attempt', color: 'orange', icon: Shield },
  'DEBUG_ATTEMPT': { label: 'Debug Attempt', color: 'yellow', icon: Terminal },
  'HOOK_DETECTED': { label: 'Hook Detected', color: 'purple', icon: Eye },
  'BAN_CHECK': { label: 'Ban Check', color: 'blue', icon: Ban }
}

export default function AdminSecurity() {
  const { user } = useAuth()
  const [logs, setLogs] = useState([])
  const [bans, setBans] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('logs')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [banModal, setBanModal] = useState({ open: false, log: null })
  const [banForm, setBanForm] = useState({ reason: '' })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [logsRes, bansRes, statsRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL}/security/logs?limit=200`).then(r => r.json()),
        fetch(`${import.meta.env.VITE_API_URL}/security/bans`).then(r => r.json()),
        fetch(`${import.meta.env.VITE_API_URL}/security/stats`).then(r => r.json())
      ])
      setLogs(logsRes.logs || [])
      setBans(bansRes.bans || [])
      setStats(statsRes.stats || null)
    } catch (err) {
      console.error('Failed to load security data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleBan = async (log) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/security/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          robloxUserId: log.robloxUserId,
          robloxName: log.robloxName,
          reason: banForm.reason || 'Security violation',
          bannedBy: user?.username || 'Admin'
        })
      })
      const data = await res.json()
      if (data.success) {
        setBanModal({ open: false, log: null })
        setBanForm({ reason: '' })
        loadData()
      } else {
        alert(data.error || 'Failed to ban user')
      }
    } catch (err) {
      console.error('Ban error:', err)
      alert('Failed to ban user')
    }
  }

  const handleUnban = async (robloxUserId) => {
    if (!confirm('Are you sure you want to unban this user?')) return
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/security/ban/${robloxUserId}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (data.success) {
        loadData()
      } else {
        alert(data.error || 'Failed to unban user')
      }
    } catch (err) {
      console.error('Unban error:', err)
    }
  }

  const handleDeleteLog = async (id) => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/security/logs/${id}`, {
        method: 'DELETE'
      })
      setLogs(logs.filter(l => l.id !== id))
    } catch (err) {
      console.error('Delete error:', err)
    }
  }

  const handleClearLogs = async () => {
    if (!confirm('Are you sure you want to clear ALL security logs?')) return
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/security/logs`, {
        method: 'DELETE'
      })
      setLogs([])
    } catch (err) {
      console.error('Clear logs error:', err)
    }
  }

  const filteredLogs = logs.filter(log => {
    const matchesSearch = !searchTerm || 
      log.robloxName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.robloxUserId.includes(searchTerm) ||
      log.placeId.includes(searchTerm)
    const matchesFilter = !filterAction || log.action === filterAction
    return matchesSearch && matchesFilter
  })

  const isUserBanned = (robloxUserId) => {
    return bans.some(b => b.robloxUserId === robloxUserId)
  }

  const formatDate = (date) => {
    return new Date(date).toLocaleString()
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
            <Shield className="w-7 h-7 text-accent" />
            Security Center
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Monitor and manage security violations
          </p>
        </div>
        <button 
          onClick={loadData}
          className="btn btn-secondary flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="panel p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(239, 68, 68, 0.2)' }}>
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Total Violations</p>
                <p className="text-2xl font-bold text-white">{stats.totalLogs}</p>
              </div>
            </div>
          </div>
          <div className="panel p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(251, 146, 60, 0.2)' }}>
                <Clock className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Last 24h</p>
                <p className="text-2xl font-bold text-white">{stats.logs24h}</p>
              </div>
            </div>
          </div>
          <div className="panel p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(239, 68, 68, 0.2)' }}>
                <Ban className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Banned Users</p>
                <p className="text-2xl font-bold text-white">{stats.totalBans}</p>
              </div>
            </div>
          </div>
          <div className="panel p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(168, 85, 247, 0.2)' }}>
                <Eye className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Dump Attempts</p>
                <p className="text-2xl font-bold text-white">{stats.byAction?.DUMP_ATTEMPT || 0}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-800 pb-2">
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2 rounded-t-lg transition-colors ${
            activeTab === 'logs' 
              ? 'bg-accent/20 text-accent' 
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Security Logs ({logs.length})
          </div>
        </button>
        <button
          onClick={() => setActiveTab('bans')}
          className={`px-4 py-2 rounded-t-lg transition-colors ${
            activeTab === 'bans' 
              ? 'bg-accent/20 text-accent' 
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <Ban className="w-4 h-4" />
            Banned Users ({bans.length})
          </div>
        </button>
      </div>

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search by name, user ID, or place ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-10 w-full"
              />
            </div>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="input w-full sm:w-48"
            >
              <option value="">All Actions</option>
              {Object.entries(ACTION_LABELS).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <button
              onClick={handleClearLogs}
              className="btn btn-danger flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Clear All
            </button>
          </div>

          {/* Logs Table */}
          <div className="panel overflow-hidden">
            {loading ? (
              <div className="p-8 text-center">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-accent" />
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
                <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No security violations recorded</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                      <th className="text-left p-4 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Action</th>
                      <th className="text-left p-4 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Player</th>
                      <th className="text-left p-4 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Place ID</th>
                      <th className="text-left p-4 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Executor</th>
                      <th className="text-left p-4 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Key</th>
                      <th className="text-left p-4 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Time</th>
                      <th className="text-right p-4 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((log) => {
                      const actionInfo = ACTION_LABELS[log.action] || { label: log.action, color: 'gray', icon: AlertTriangle }
                      const ActionIcon = actionInfo.icon
                      const banned = isUserBanned(log.robloxUserId)
                      
                      return (
                        <tr 
                          key={log.id} 
                          className="hover:bg-zinc-800/50 transition-colors"
                          style={{ borderBottom: '1px solid var(--border-primary)' }}
                        >
                          <td className="p-4">
                            <div className={`inline-flex items-center gap-2 px-2 py-1 rounded text-xs font-medium bg-${actionInfo.color}-500/20 text-${actionInfo.color}-400`}
                              style={{ 
                                background: `rgba(var(--${actionInfo.color === 'red' ? '239, 68, 68' : actionInfo.color === 'orange' ? '251, 146, 60' : actionInfo.color === 'yellow' ? '250, 204, 21' : actionInfo.color === 'purple' ? '168, 85, 247' : '59, 130, 246'}), 0.2)`,
                                color: actionInfo.color === 'red' ? '#f87171' : actionInfo.color === 'orange' ? '#fb923c' : actionInfo.color === 'yellow' ? '#facc15' : actionInfo.color === 'purple' ? '#a855f7' : '#60a5fa'
                              }}
                            >
                              <ActionIcon className="w-3 h-3" />
                              {actionInfo.label}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-zinc-500" />
                              <div>
                                <p className="text-white font-medium">{log.robloxName}</p>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{log.robloxUserId}</p>
                              </div>
                              {banned && (
                                <span className="px-1.5 py-0.5 rounded text-xs bg-red-500/20 text-red-400">
                                  BANNED
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <Gamepad2 className="w-4 h-4 text-zinc-500" />
                              <span style={{ color: 'var(--text-secondary)' }}>{log.placeId}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <Terminal className="w-4 h-4 text-zinc-500" />
                              <span style={{ color: 'var(--text-secondary)' }}>{log.executor || 'Unknown'}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            {log.keyUsed ? (
                              <div className="flex items-center gap-2">
                                <Key className="w-4 h-4 text-zinc-500" />
                                <code className="text-xs bg-zinc-800 px-2 py-1 rounded">{log.keyUsed.substring(0, 12)}...</code>
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>-</span>
                            )}
                          </td>
                          <td className="p-4">
                            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                              {formatDate(log.createdAt)}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-end gap-2">
                              {!banned && (
                                <button
                                  onClick={() => setBanModal({ open: true, log })}
                                  className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                                  title="Ban User"
                                >
                                  <UserX className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteLog(log.id)}
                                className="p-2 rounded-lg hover:bg-zinc-700 transition-colors"
                                style={{ color: 'var(--text-muted)' }}
                                title="Delete Log"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bans Tab */}
      {activeTab === 'bans' && (
        <div className="panel overflow-hidden">
          {bans.length === 0 ? (
            <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
              <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No banned users</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                    <th className="text-left p-4 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Player</th>
                    <th className="text-left p-4 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Reason</th>
                    <th className="text-left p-4 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Banned By</th>
                    <th className="text-left p-4 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Date</th>
                    <th className="text-right p-4 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bans.map((ban) => (
                    <tr 
                      key={ban.id}
                      className="hover:bg-zinc-800/50 transition-colors"
                      style={{ borderBottom: '1px solid var(--border-primary)' }}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                            <Ban className="w-5 h-5 text-red-400" />
                          </div>
                          <div>
                            <p className="text-white font-medium">{ban.robloxName}</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{ban.robloxUserId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span style={{ color: 'var(--text-secondary)' }}>{ban.reason || 'No reason'}</span>
                      </td>
                      <td className="p-4">
                        <span style={{ color: 'var(--text-secondary)' }}>{ban.bannedBy || 'System'}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                          {formatDate(ban.createdAt)}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex justify-end">
                          <button
                            onClick={() => handleUnban(ban.robloxUserId)}
                            className="btn btn-secondary text-sm flex items-center gap-2"
                          >
                            <XCircle className="w-4 h-4" />
                            Unban
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Ban Modal */}
      {banModal.open && banModal.log && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="panel p-6 w-full max-w-md mx-4">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <UserX className="w-5 h-5 text-red-400" />
              Ban User
            </h3>
            <div className="space-y-4">
              <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                <p className="text-white font-medium">{banModal.log.robloxName}</p>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>User ID: {banModal.log.robloxUserId}</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Reason (optional)
                </label>
                <input
                  type="text"
                  value={banForm.reason}
                  onChange={(e) => setBanForm({ reason: e.target.value })}
                  placeholder="e.g., Attempted to dump scripts"
                  className="input w-full"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setBanModal({ open: false, log: null })}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleBan(banModal.log)}
                  className="btn btn-danger flex-1 flex items-center justify-center gap-2"
                >
                  <Ban className="w-4 h-4" />
                  Ban User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
