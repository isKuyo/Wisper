import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import api from '../services/api'
import { 
  Key, 
  Copy, 
  Check, 
  RefreshCw, 
  AlertCircle, 
  ArrowRight,
  Clock,
  Monitor,
  Gamepad2,
  Plus
} from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const LOADER_URL = API_URL.replace('/api', '/loader')

export default function DashboardPage() {
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [keyData, setKeyData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(null)
  
  // Real-time countdown state
  const [timeRemaining, setTimeRemaining] = useState(null)
  const [hwidWindowTime, setHwidWindowTime] = useState(null)
  const countdownRef = useRef(null)

  useEffect(() => {
    loadKeyData()
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [])

  // Setup real-time countdown when keyData changes
  useEffect(() => {
    if (countdownRef.current) clearInterval(countdownRef.current)
    
    if (keyData?.key?.expiresAt && !keyData.key.isPermanent) {
      const updateCountdown = () => {
        const now = Date.now()
        const expiresAt = new Date(keyData.key.expiresAt).getTime()
        const diff = expiresAt - now
        
        if (diff <= 0) {
          setTimeRemaining({ hours: 0, minutes: 0, seconds: 0, expired: true })
          clearInterval(countdownRef.current)
          return
        }
        
        const hours = Math.floor(diff / (1000 * 60 * 60))
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((diff % (1000 * 60)) / 1000)
        setTimeRemaining({ hours, minutes, seconds, expired: false })
      }
      
      updateCountdown()
      countdownRef.current = setInterval(updateCountdown, 1000)
    }
    
    // Update HWID window reset time
    if (keyData?.key?.hwidWindowResetTime) {
      setHwidWindowTime(keyData.key.hwidWindowResetTime)
    }
  }, [keyData])

  const loadKeyData = async () => {
    try {
      const data = await api.getMyKey()
      setKeyData(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const generateKey = async () => {
    if (keyData?.checkpointsRequired > 0 && !keyData?.canGenerateKey) {
      navigate('/checkpoints')
      return
    }

    setGenerating(true)
    setError(null)
    try {
      const data = await api.generateKey()
      setKeyData({
        hasKey: true,
        key: {
          key: data.key,
          isActive: true,
          hwidBound: false,
          hwidResetCount: 0,
          expiresAt: data.expiresAt,
          activatedAt: data.activatedAt
        },
        checkpointsRequired: 0,
        checkpointsCompleted: 0,
        allCheckpointsCompleted: true
      })
      await refreshUser()
    } catch (err) {
      if (err.code === 'CHECKPOINTS_INCOMPLETE') {
        navigate('/checkpoints')
        return
      }
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  const [loaderCopied, setLoaderCopied] = useState(false)

  const copyLoader = () => {
    navigator.clipboard.writeText(`loadstring(game:HttpGet("${LOADER_URL}"))()`)
    setLoaderCopied(true)
    setTimeout(() => setLoaderCopied(false), 2000)
  }

  const resetHwid = async () => {
    if (!confirm('Are you sure you want to reset your HWID?')) return
    
    setResetting(true)
    setError(null)
    try {
      await api.resetHwid()
      await loadKeyData()
      await refreshUser()
    } catch (err) {
      setError(err.message)
    } finally {
      setResetting(false)
    }
  }

  const copyKey = () => {
    if (keyData?.key?.key) {
      navigator.clipboard.writeText(keyData.key.key)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
        <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>Manage your key and view your status</p>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {keyData?.hasKey ? (
        <>
          {/* Key Display Card */}
          <div className="panel">
            <div className="panel-header">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-accent" />
                <span className="text-sm font-medium">Your Key</span>
              </div>
              <div className="flex items-center gap-2">
                {keyData.key.isActive && !keyData.key.isExpired ? (
                  <span className="badge badge-success">Active</span>
                ) : (
                  <span className="badge badge-danger">
                    {keyData.key.isExpired ? 'Expired' : 'Inactive'}
                  </span>
                )}
              </div>
            </div>
            <div className="panel-body">
              <div className="flex items-center gap-3">
                <div className="flex-1 rounded-lg px-4 py-3 font-mono text-sm text-white" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                  {keyData.key.key}
                </div>
                <button
                  onClick={copyKey}
                  className="btn btn-secondary p-3"
                  title="Copy"
                >
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="stat-card">
              <div className="flex items-center justify-center gap-2 text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                <Clock className="w-3.5 h-3.5" />
                Time Remaining
              </div>
              <div className="stat-value text-lg font-mono">
                {keyData.key.isPermanent ? (
                  <span className="text-green-400">∞</span>
                ) : timeRemaining ? (
                  timeRemaining.expired ? (
                    <span className="text-red-400">Expired</span>
                  ) : (
                    <span>{timeRemaining.hours}h {timeRemaining.minutes}m {timeRemaining.seconds}s</span>
                  )
                ) : keyData.key.isExpired ? (
                  <span className="text-red-400">Expired</span>
                ) : (
                  <span className="text-green-400">∞</span>
                )}
              </div>
              {!keyData.key.isPermanent && (
                <button
                  onClick={() => navigate('/checkpoints')}
                  className="btn btn-primary w-full mt-3 py-2 text-xs"
                >
                  <Plus className="w-3 h-3" />
                  Add Time
                </button>
              )}
            </div>

            <div className="stat-card">
              <div className="flex items-center justify-center gap-2 text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                <Monitor className="w-3.5 h-3.5" />
                Executor
              </div>
              <div className="text-white font-medium text-sm truncate">
                {keyData.key.lastExecutor || <span style={{ color: 'var(--text-muted)' }}>-</span>}
              </div>
            </div>

            <div className="stat-card">
              <div className="flex items-center justify-center gap-2 text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                <Gamepad2 className="w-3.5 h-3.5" />
                HWID (Hash)
              </div>
              <div className="text-white font-medium text-xs font-mono truncate" title={keyData.key.hwidHash || ''}>
                {keyData.key.hwidHash ? (
                  <span>{keyData.key.hwidHash.substring(0, 8)}...</span>
                ) : (
                  <span className="text-yellow-400">Not bound</span>
                )}
              </div>
            </div>

            <div className="stat-card">
              <div className="flex items-center justify-center gap-2 text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                <RefreshCw className="w-3.5 h-3.5" />
                HWID Resets
              </div>
              <div className="text-white font-medium">
                {keyData.key.hwidResetsRemaining === 'unlimited' ? (
                  <span className="text-accent">∞</span>
                ) : keyData.key.hwidResetsRemaining > 0 ? (
                  <span>{keyData.key.hwidResetsRemaining} left</span>
                ) : hwidWindowTime ? (
                  <span className="text-yellow-400 text-xs">
                    {hwidWindowTime.hours}h {hwidWindowTime.minutes}m
                  </span>
                ) : (
                  <span>0 left</span>
                )}
              </div>
            </div>
          </div>

          {/* HWID Reset */}
          <div className="panel">
            <div className="panel-header">
              <div>
                <div className="text-white font-medium">Reset HWID</div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {keyData.isOwner ? (
                    <span className="text-green-400">Owner - Unlimited resets</span>
                  ) : (
                    `${keyData.key.hwidResetConfig?.maxResetsPerWindow || 2} resets per ${keyData.key.hwidResetConfig?.windowHours || 12}h`
                  )}
                </div>
              </div>
            </div>
            <div className="panel-body">
              {!keyData.isOwner && keyData.key.hwidResetCooldownRemaining && (
                <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-400 text-sm mb-4">
                  <Clock className="w-4 h-4" />
                  Wait {keyData.key.hwidResetCooldownRemaining} minutes
                </div>
              )}

              <button
                onClick={resetHwid}
                disabled={resetting || (!keyData.isOwner && !keyData.key.hwidResetAvailable)}
                className="btn btn-secondary w-full"
              >
                {resetting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Reset HWID
                  </>
                )}
              </button>
            </div>
          </div>

        </>
      ) : (
        /* No Key - Generate */
        <div className="panel p-10 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: 'var(--bg-tertiary)' }}>
            <Key className="w-8 h-8 text-accent" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Get Your Key</h3>
          <p className="mb-8" style={{ color: 'var(--text-secondary)' }}>
            {keyData?.checkpointsRequired > 0 
              ? 'Complete the checkpoints to generate your key'
              : 'Click below to generate your key'}
          </p>
          <button
            onClick={generateKey}
            disabled={generating}
            className="btn btn-primary px-8 py-3"
          >
            {generating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Loading...
              </>
            ) : keyData?.checkpointsRequired > 0 && !keyData?.canGenerateKey ? (
              <>
                <ArrowRight className="w-4 h-4" />
                Complete Checkpoints
              </>
            ) : (
              <>
                <Key className="w-4 h-4" />
                Generate Key
              </>
            )}
          </button>
        </div>
      )}

      {/* Loader Instructions */}
      <div className="panel">
        <div className="panel-header">
          <div className="flex items-center gap-2">
            <Gamepad2 className="w-4 h-4 text-accent" />
            <span className="font-medium">How to use</span>
          </div>
        </div>
        <div className="panel-body">
          <div className="flex items-center gap-3">
            <div className="flex-1 rounded-lg p-4 font-mono text-xs overflow-x-auto" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              loadstring(game:HttpGet("<span className="text-accent">{LOADER_URL}</span>"))()
            </div>
            <button
              onClick={copyLoader}
              className="btn btn-secondary p-3"
              title="Copy"
            >
              {loaderCopied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <p className="text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
            Execute in your Roblox executor and enter your key when prompted.
          </p>
        </div>
      </div>
    </div>
  )
}
