import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import api from '../services/api'
import { 
  CheckCircle, 
  ExternalLink, 
  AlertCircle,
  Lock,
  Key,
  Clock,
  Shield,
  Plus
} from 'lucide-react'

export default function CheckpointsPage() {
  const { refreshUser } = useAuth()
  const navigate = useNavigate()
  const [checkpoints, setCheckpoints] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [generatingKey, setGeneratingKey] = useState(false)
  const [hasExistingKey, setHasExistingKey] = useState(false)
  const [isExtending, setIsExtending] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [checkpointsData, keyData] = await Promise.all([
        api.getCheckpoints(),
        api.getMyKey()
      ])
      setCheckpoints(checkpointsData.checkpoints)
      setHasExistingKey(keyData.hasKey && !keyData.key?.isPermanent)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const startCheckpoint = async (checkpoint) => {
    try {
      const data = await api.startCheckpoint(checkpoint.id)
      localStorage.setItem('pending_checkpoint', JSON.stringify({
        id: checkpoint.id,
        token: data.trackingToken,
        startedAt: Date.now()
      }))
      window.location.href = data.url
    } catch (err) {
      setError(err.message)
    }
  }

  const completedCount = checkpoints.filter(c => c.completed).length
  const totalCount = checkpoints.length
  const allCompleted = completedCount >= totalCount && totalCount > 0
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading checkpoints...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Header Card */}
      <div className="panel p-8 text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: 'var(--bg-tertiary)' }}>
          <Shield className="w-8 h-8 text-accent" />
        </div>
        <h1 className="text-2xl font-semibold text-white mb-2">Complete Checkpoints</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          {hasExistingKey 
            ? 'Complete all steps below to extend your key by 6 hours'
            : 'Complete all steps below to generate your key'}
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Progress */}
      <div className="panel p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
            <Clock className="w-4 h-4" />
            <span className="text-sm">Progress</span>
          </div>
          <span className="text-sm font-semibold text-accent">{completedCount} of {totalCount}</span>
        </div>
        
        <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
          <div 
            className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        
        <p className="text-xs mt-3 text-center" style={{ color: 'var(--text-muted)' }}>
          {allCompleted ? 'All checkpoints completed!' : `${Math.round(progressPercent)}% complete`}
        </p>
      </div>

      {/* Checkpoints List */}
      <div className="space-y-3">
        {checkpoints.length === 0 ? (
          <div className="panel p-10 text-center">
            <CheckCircle className="w-14 h-14 text-green-400 mx-auto mb-4" />
            <h3 className="text-white font-semibold mb-2">No Checkpoints Required</h3>
            <p style={{ color: 'var(--text-secondary)' }}>Your key is ready to use!</p>
          </div>
        ) : (
          checkpoints.map((checkpoint, index) => (
            <div 
              key={checkpoint.id}
              className={`panel p-5 transition-all ${
                checkpoint.completed 
                  ? 'border-green-500/30 bg-green-500/5' 
                  : checkpoint.canAccess 
                    ? 'hover:border-[#3f3f46]' 
                    : 'opacity-50'
              }`}
            >
              <div className="flex items-center gap-4">
                {/* Step Number */}
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold ${
                  checkpoint.completed 
                    ? 'bg-green-500/20 text-green-400' 
                    : checkpoint.canAccess 
                      ? 'text-white' 
                      : 'text-[#444]'
                }`} style={!checkpoint.completed ? { background: checkpoint.canAccess ? 'var(--accent)' : 'var(--bg-tertiary)' } : {}}>
                  {checkpoint.completed ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : checkpoint.canAccess ? (
                    <span>{index + 1}</span>
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-medium">
                    {checkpoint.name || `Step ${checkpoint.order}`}
                  </h3>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    {checkpoint.completed ? (
                      <span className="text-green-400">Completed</span>
                    ) : checkpoint.canAccess ? (
                      <span>Click to start • <span className="capitalize">{checkpoint.platform}</span></span>
                    ) : (
                      <span>Complete previous step first</span>
                    )}
                  </p>
                </div>

                {/* Action */}
                {checkpoint.completed ? (
                  <div className="flex items-center gap-1.5 text-green-400">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">Done</span>
                  </div>
                ) : checkpoint.canAccess ? (
                  <button
                    onClick={() => startCheckpoint(checkpoint)}
                    className="btn btn-primary"
                  >
                    Start
                    <ExternalLink className="w-4 h-4" />
                  </button>
                ) : (
                  <Lock className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Generate/Extend Key Button */}
      {allCompleted && (
        <div className="panel p-8 text-center" style={{ 
          background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.05))',
          borderColor: 'rgba(34, 197, 94, 0.3)'
        }}>
          <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
          <h3 className="text-white font-semibold mb-2">All Checkpoints Complete!</h3>
          <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
            {hasExistingKey 
              ? 'You can now extend your key by 6 hours'
              : 'You can now generate your key'}
          </p>
          <button
            onClick={async () => {
              if (hasExistingKey) {
                setIsExtending(true)
                try {
                  await api.extendKey()
                  await refreshUser()
                  navigate('/dashboard')
                } catch (err) {
                  setError(err.message)
                  setIsExtending(false)
                }
              } else {
                setGeneratingKey(true)
                try {
                  await api.generateKey()
                  await refreshUser()
                  navigate('/dashboard')
                } catch (err) {
                  setError(err.message)
                  setGeneratingKey(false)
                }
              }
            }}
            disabled={generatingKey || isExtending}
            className="btn btn-primary px-8 py-3"
          >
            {generatingKey || isExtending ? (
              <>
                <div className="spinner" style={{ width: '16px', height: '16px' }} />
                {hasExistingKey ? 'Extending...' : 'Generating...'}
              </>
            ) : hasExistingKey ? (
              <>
                <Plus className="w-4 h-4" />
                Extend Key (+6h)
              </>
            ) : (
              <>
                <Key className="w-4 h-4" />
                Generate My Key
              </>
            )}
          </button>
        </div>
      )}

      {/* Info */}
      <div className="text-center text-xs" style={{ color: 'var(--text-muted)' }}>
        <p>Complete each checkpoint in order. You'll be redirected back automatically.</p>
      </div>
    </div>
  )
}
