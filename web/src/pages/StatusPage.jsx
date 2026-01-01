import { useState, useEffect } from 'react'
import api from '../services/api'
import { 
  CheckCircle, 
  AlertTriangle, 
  Wrench,
  Gamepad2,
  RefreshCw
} from 'lucide-react'

export default function StatusPage() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadStatus()
  }, [])

  const loadStatus = async () => {
    setLoading(true)
    try {
      const data = await api.getHubStatus()
      setStatus(data.status)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading status...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="panel p-8 text-center" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
          <AlertTriangle className="w-14 h-14 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Error Loading Status</h2>
          <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
        </div>
      </div>
    )
  }

  const isHubOnline = !status?.maintenanceMode
  const gamesInMaintenance = status?.gamesInMaintenance || []

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="text-center py-4">
        <h1 className="text-2xl font-semibold text-white mb-2">System Status</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Current status of {status?.hubName || 'Wisper Hub'}</p>
      </div>

      {/* Hub Status */}
      <div className="panel p-6" style={{ 
        borderColor: isHubOnline ? 'rgba(34, 197, 94, 0.3)' : 'rgba(249, 115, 22, 0.3)'
      }}>
        <div className="flex items-center gap-5">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
            isHubOnline ? 'bg-green-500/20' : 'bg-orange-500/20'
          }`}>
            {isHubOnline ? (
              <CheckCircle className="w-8 h-8 text-green-400" />
            ) : (
              <Wrench className="w-8 h-8 text-orange-400" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-white">Hub Status</h2>
              <span className={`badge ${isHubOnline ? 'badge-success' : 'badge-warning'}`}>
                {isHubOnline ? 'Online' : 'Maintenance'}
              </span>
            </div>
            <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
              {isHubOnline 
                ? 'All systems are operational' 
                : status?.maintenanceMessage || 'The hub is currently under maintenance'}
            </p>
          </div>
        </div>
      </div>

      {/* Games in Maintenance */}
      {gamesInMaintenance.length > 0 && (
        <div className="panel p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-400" />
            Games Under Maintenance
          </h3>
          
          <div className="space-y-3">
            {gamesInMaintenance.map((game) => (
              <div key={game.id} className="flex items-center gap-4 p-4 rounded-xl" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                {game.iconUrl ? (
                  <img src={game.iconUrl} alt={game.name} className="w-12 h-12 rounded-xl" />
                ) : (
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'var(--bg-tertiary)' }}>
                    <Gamepad2 className="w-6 h-6" style={{ color: 'var(--text-muted)' }} />
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{game.name}</span>
                    <span className="badge badge-warning">Maintenance</span>
                  </div>
                  {game.maintenanceMessage && (
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{game.maintenanceMessage}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Games Online */}
      {isHubOnline && gamesInMaintenance.length === 0 && (
        <div className="panel p-8 text-center" style={{ 
          background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.05))',
          borderColor: 'rgba(34, 197, 94, 0.3)'
        }}>
          <CheckCircle className="w-14 h-14 text-green-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">All Systems Operational</h3>
          <p style={{ color: 'var(--text-secondary)' }}>All games and services are running normally.</p>
        </div>
      )}

      {/* Refresh Button */}
      <div className="text-center">
        <button
          onClick={loadStatus}
          disabled={loading}
          className="btn btn-secondary"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Status
        </button>
      </div>
    </div>
  )
}
