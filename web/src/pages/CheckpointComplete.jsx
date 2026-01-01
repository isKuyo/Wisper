import { useEffect, useState, useRef } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { CheckCircle, AlertCircle, Loader, Shield } from 'lucide-react'

// Cloudflare Turnstile Site Key
const TURNSTILE_SITE_KEY = '0x4AAAAAACJF_DCdb7-SfU4d'

export default function CheckpointComplete() {
  const { id: paramId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('verifying') // verifying, loading, success, error
  const [message, setMessage] = useState('')
  const [turnstileToken, setTurnstileToken] = useState(null)
  const turnstileRef = useRef(null)
  const widgetIdRef = useRef(null)

  // Load Turnstile script
  useEffect(() => {
    let mounted = true
    
    const loadAndRender = () => {
      if (!mounted || !turnstileRef.current) return
      
      // Don't render if already rendered
      if (widgetIdRef.current) return
      
      // Check if script already loaded
      if (window.turnstile) {
        renderTurnstile()
        return
      }

      // Check if script is already being loaded
      const existingScript = document.querySelector('script[src*="turnstile"]')
      if (existingScript) {
        existingScript.addEventListener('load', () => {
          if (mounted) renderTurnstile()
        })
        return
      }

      const script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
      script.async = true
      script.onload = () => {
        if (mounted) renderTurnstile()
      }
      document.head.appendChild(script)
    }

    // Small delay to ensure DOM is ready
    const timer = setTimeout(loadAndRender, 100)

    return () => {
      mounted = false
      clearTimeout(timer)
      // Cleanup widget on unmount
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current)
        } catch (e) {}
        widgetIdRef.current = null
      }
    }
  }, [])

  const renderTurnstile = () => {
    if (!turnstileRef.current || !window.turnstile) return
    
    // Prevent duplicate renders
    if (widgetIdRef.current) return
    
    // Clear any existing content
    turnstileRef.current.innerHTML = ''
    
    widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      theme: 'dark',
      callback: (token) => {
        setTurnstileToken(token)
      },
      'error-callback': () => {
        setStatus('error')
        setMessage('Human verification failed. Please refresh and try again.')
      }
    })
  }

  // Auto-complete when turnstile is verified
  useEffect(() => {
    if (turnstileToken) {
      completeCheckpoint()
    }
  }, [turnstileToken])

  const completeCheckpoint = async () => {
    setStatus('loading')
    
    try {
      // Try to get checkpoint info from multiple sources
      let checkpointId = paramId || searchParams.get('checkpoint')
      let token = searchParams.get('token')
      
      // If not in URL, check localStorage (for Work.ink and similar)
      if (!checkpointId) {
        const pending = localStorage.getItem('pending_checkpoint')
        if (pending) {
          const data = JSON.parse(pending)
          // Only use if started within last 30 minutes
          if (Date.now() - data.startedAt < 30 * 60 * 1000) {
            checkpointId = data.id
            token = data.token
          }
        }
      }
      
      if (!checkpointId) {
        setStatus('error')
        setMessage('No pending checkpoint found. Please start a checkpoint first.')
        return
      }
      
      const data = await api.completeCheckpoint(checkpointId, token, turnstileToken)
      
      // Clear pending checkpoint from localStorage
      localStorage.removeItem('pending_checkpoint')
      
      setStatus('success')
      setMessage(data.allCompleted 
        ? 'All checkpoints completed! Your key is now active.'
        : `Checkpoint completed! ${data.checkpointsRequired - data.checkpointsCompleted} more to go.`
      )

      // Redirect after delay
      setTimeout(() => {
        navigate('/checkpoints')
      }, 3000)
    } catch (err) {
      setStatus('error')
      setMessage(err.message)
    }
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="bg-[#111] border border-[#222] rounded-xl p-8 max-w-md w-full text-center animate-fade-in">
        {status === 'verifying' && (
          <>
            <div className="w-16 h-16 rounded-full bg-[#1a1a1a] flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-[#888]" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Human Verification</h2>
            <p className="text-[#666] text-sm mb-6">Please complete the verification below to continue.</p>
            
            {/* Turnstile Widget */}
            <div className="flex justify-center mb-4">
              <div ref={turnstileRef}></div>
            </div>
            
            <p className="text-[#444] text-xs">This helps us prevent automated bypass attempts.</p>
          </>
        )}

        {status === 'loading' && (
          <>
            <div className="w-16 h-16 rounded-full bg-[#1a1a1a] flex items-center justify-center mx-auto mb-4">
              <Loader className="w-8 h-8 text-white animate-spin" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Validating Checkpoint...</h2>
            <p className="text-[#666] text-sm">Please wait while we verify your completion.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Success!</h2>
            <p className="text-[#666] text-sm mb-4">{message}</p>
            <p className="text-[#444] text-xs">Redirecting to checkpoints...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Error</h2>
            <p className="text-[#666] text-sm mb-6">{message}</p>
            <button
              onClick={() => navigate('/checkpoints')}
              className="px-6 py-2.5 bg-white text-black hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
            >
              Back to Checkpoints
            </button>
          </>
        )}
      </div>
    </div>
  )
}
