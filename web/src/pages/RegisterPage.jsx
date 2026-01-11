import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import api from '../services/api'
import { AlertCircle, Mail, Lock, Eye, EyeOff, User } from 'lucide-react'

export default function RegisterPage() {
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()
  
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (user) {
      navigate('/dashboard')
    }
  }, [user, navigate])

  const handleDiscordLogin = () => {
    window.location.href = api.getDiscordAuthUrl()
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    try {
      await api.register(username, email, password)
      await refreshUser()
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="w-full max-w-md animate-fade-in">
        <div className="card p-8">
          <h2 className="text-2xl font-semibold text-white mb-2 text-center">Create Account</h2>
          <p className="mb-6 text-center" style={{ color: 'var(--text-secondary)' }}>
            Sign up to start using Wisper Hub
          </p>

          {error && (
            <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 mb-6">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Register Form */}
          <form onSubmit={handleRegister} className="space-y-4 mb-6">
            <div>
              <label className="block text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input pl-11 w-full"
                  placeholder="johndoe"
                  pattern="^[a-zA-Z0-9_]+$"
                  minLength={3}
                  maxLength={32}
                  required
                />
              </div>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Letters, numbers and underscores only</p>
            </div>

            <div>
              <label className="block text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-11 w-full"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-11 pr-11 w-full"
                  placeholder="••••••••"
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input pl-11 w-full"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg font-medium text-white transition-all hover:scale-[1.02] disabled:opacity-50"
              style={{ background: 'var(--accent)' }}
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" style={{ borderColor: 'var(--border)' }}></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>or continue with</span>
            </div>
          </div>

          {/* Discord Login */}
          <button
            onClick={handleDiscordLogin}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-lg font-medium transition-all hover:scale-[1.02]"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            Discord
          </button>

          {/* Login Link */}
          <p className="text-center mt-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Already have an account?{' '}
            <Link to="/login" className="text-accent hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
