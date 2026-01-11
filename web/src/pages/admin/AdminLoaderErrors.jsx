import { useState, useEffect } from 'react'
import { AlertTriangle, Trash2, RefreshCw, Terminal, Clock, User, Gamepad2, Cpu, Copy, Check } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'https://api.wisper.lol/api'

export default function AdminLoaderErrors() {
  const [errors, setErrors] = useState([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [copiedId, setCopiedId] = useState(null)

  const copyError = async (error) => {
    const text = `Error: ${error.error}\n\nStack: ${error.stack || 'N/A'}\n\nExecutor: ${error.executor}\nPlaceId: ${error.placeId}\nUserId: ${error.userId}\nHWID: ${error.hwid}\nIP: ${error.ip}\nTime: ${error.timestamp}`
    await navigator.clipboard.writeText(text)
    setCopiedId(error.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const fetchErrors = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_URL}/loader/errors?limit=100`)
      const data = await response.json()
      setErrors(data.errors || [])
      setTotal(data.total || 0)
    } catch (error) {
      console.error('Failed to fetch errors:', error)
    } finally {
      setLoading(false)
    }
  }

  const clearErrors = async () => {
    if (!confirm('Clear all error logs?')) return
    try {
      await fetch(`${API_URL}/loader/errors`, { method: 'DELETE' })
      setErrors([])
      setTotal(0)
    } catch (error) {
      console.error('Failed to clear errors:', error)
    }
  }

  useEffect(() => {
    fetchErrors()
    const interval = setInterval(fetchErrors, 10000)
    return () => clearInterval(interval)
  }, [])

  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleString()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            Loader Execution Errors
          </h2>
          <p className="text-slate-400 mt-1">
            Real-time error logs from Roblox script execution ({total} total)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchErrors}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={clearErrors}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Clear All
          </button>
        </div>
      </div>

      {loading && errors.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 text-sky-500 animate-spin" />
        </div>
      ) : errors.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-12 text-center">
          <Terminal className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-400">No Errors Logged</h3>
          <p className="text-slate-500 mt-2">
            Execution errors from the loader will appear here in real-time
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {errors.map((error) => (
            <div
              key={error.id}
              className="bg-slate-800/50 border border-red-900/30 rounded-xl p-4 hover:border-red-800/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <span className="text-red-400 font-mono text-sm truncate flex-1">
                      {error.error}
                    </span>
                    <button
                      onClick={() => copyError(error)}
                      className="flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-xs transition-colors flex-shrink-0"
                    >
                      {copiedId === error.id ? (
                        <>
                          <Check className="w-3 h-3 text-green-500" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                  
                  {error.stack && (
                    <pre className="bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-xs text-slate-400 font-mono overflow-x-auto whitespace-pre-wrap mb-3">
                      {error.stack}
                    </pre>
                  )}
                  
                  <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTime(error.timestamp)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Cpu className="w-3 h-3" />
                      {error.executor}
                    </span>
                    <span className="flex items-center gap-1">
                      <Gamepad2 className="w-3 h-3" />
                      PlaceId: {error.placeId}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      UserId: {error.userId}
                    </span>
                    {error.hwid && (
                      <span className="text-slate-600">
                        HWID: {error.hwid.substring(0, 8)}...
                      </span>
                    )}
                    <span className="text-slate-600">
                      IP: {error.ip}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
