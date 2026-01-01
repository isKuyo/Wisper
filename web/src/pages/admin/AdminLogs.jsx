import { useState, useEffect } from 'react'
import api from '../../services/api'
import { 
  FileText, 
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle,
  XCircle
} from 'lucide-react'

export default function AdminLogs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [eventFilter, setEventFilter] = useState('')

  const eventTypes = [
    { value: '', label: 'All Events' },
    { value: 'user_login', label: 'User Login' },
    { value: 'user_register', label: 'User Register' },
    { value: 'key_generated', label: 'Key Generated' },
    { value: 'key_validated', label: 'Key Validated' },
    { value: 'key_validation_failed', label: 'Key Validation Failed' },
    { value: 'key_hwid_mismatch', label: 'HWID Mismatch' },
    { value: 'key_hwid_reset', label: 'HWID Reset' },
    { value: 'checkpoint_completed', label: 'Checkpoint Completed' },
    { value: 'script_downloaded', label: 'Script Downloaded' },
    { value: 'admin_user_banned', label: 'User Banned' },
    { value: 'admin_hwid_reset', label: 'Admin HWID Reset' }
  ]

  useEffect(() => {
    loadLogs()
  }, [pagination.page, eventFilter])

  const loadLogs = async () => {
    setLoading(true)
    try {
      const data = await api.getLogs(pagination.page, 50, eventFilter)
      setLogs(data.logs)
      setPagination(data.pagination)
    } catch (err) {
      console.error('Failed to load logs:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatEvent = (event) => {
    return event.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const getEventColor = (event) => {
    if (event.includes('failed') || event.includes('mismatch') || event.includes('banned')) {
      return 'text-red-400'
    }
    if (event.includes('login') || event.includes('register') || event.includes('completed')) {
      return 'text-green-400'
    }
    if (event.includes('admin')) {
      return 'text-yellow-400'
    }
    return 'text-primary-400'
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Audit Logs</h1>
          <p className="text-dark-400">View system activity and events</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-dark-500" />
          <select
            value={eventFilter}
            onChange={(e) => {
              setEventFilter(e.target.value)
              setPagination(p => ({ ...p, page: 1 }))
            }}
            className="input w-auto"
          >
            {eventTypes.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
          
          <button
            onClick={loadLogs}
            className="btn btn-secondary"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-dark-800 border-b border-dark-700">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-dark-400">Time</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-dark-400">Event</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-dark-400">User</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-dark-400">Details</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-dark-400">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-dark-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-dark-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    No logs found
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-dark-800/50">
                    <td className="px-4 py-3 text-sm text-dark-400 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-medium ${getEventColor(log.event)}`}>
                        {formatEvent(log.event)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {log.user ? (
                        <div className="text-sm">
                          <div className="font-medium">{log.user.username}</div>
                          <div className="text-dark-500">{log.user.discordId}</div>
                        </div>
                      ) : (
                        <span className="text-dark-500 text-sm">System</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {log.details ? (
                        <pre className="text-xs text-dark-400 max-w-xs overflow-hidden">
                          {JSON.stringify(JSON.parse(log.details), null, 0).slice(0, 100)}
                        </pre>
                      ) : (
                        <span className="text-dark-500 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {log.success ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-dark-800">
            <span className="text-dark-400 text-sm">
              Page {pagination.page} of {pagination.pages} ({pagination.total} logs)
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                disabled={pagination.page <= 1}
                className="btn btn-secondary py-1 px-2"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                disabled={pagination.page >= pagination.pages}
                className="btn btn-secondary py-1 px-2"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
