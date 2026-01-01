import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { 
  Shield, 
  Key, 
  Zap, 
  Lock, 
  ArrowRight
} from 'lucide-react'

export default function HomePage() {
  const { user } = useAuth()

  const features = [
    {
      icon: Key,
      title: 'Key System',
      description: 'Secure authentication linked to your device HWID'
    },
    {
      icon: Shield,
      title: 'Secure',
      description: 'All validation happens server-side. No vulnerabilities'
    },
    {
      icon: Zap,
      title: 'Fast',
      description: 'Instant script loading after authentication'
    },
    {
      icon: Lock,
      title: 'Protected',
      description: 'Scripts are never exposed without valid authentication'
    }
  ]

  return (
    <div className="space-y-20 animate-fade-in">
      {/* Hero Section */}
      <section className="text-center py-16">
        <h1 className="text-4xl md:text-5xl font-light text-white mb-4">
          what is <span className="text-accent font-semibold">wisperhub</span>?
        </h1>
        
        <p className="max-w-lg mx-auto mb-10 text-lg" style={{ color: 'var(--text-secondary)' }}>
          wisperhub is a professional script hub for Roblox, designed to provide secure access to premium scripts with advanced protection.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {user ? (
            <Link 
              to="/dashboard" 
              className="btn btn-primary px-8 py-3"
            >
              Go to Dashboard
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <Link 
              to="/login" 
              className="btn btn-discord px-8 py-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.36-.698.772-1.362 1.225-1.993a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.12-.098.246-.198.373-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              Sign in with Discord
            </Link>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="panel p-6 hover:border-[#3f3f46] transition-all cursor-default"
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5" style={{ background: 'var(--bg-tertiary)' }}>
                <feature.icon className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-white font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it Works */}
      <section>
        <h2 className="text-2xl font-semibold text-white text-center mb-10">How it works</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { step: '01', title: 'Sign in with Discord', description: 'Create your account using Discord OAuth' },
            { step: '02', title: 'Get Your Key', description: 'Complete the checkpoints to generate your key' },
            { step: '03', title: 'Execute Script', description: 'Use your key in the loader to access scripts' }
          ].map((item, index) => (
            <div key={index} className="panel p-6">
              <div className="text-4xl font-bold mb-4 text-accent opacity-30">{item.step}</div>
              <h3 className="text-white font-semibold mb-2">{item.title}</h3>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="panel p-10 text-center" style={{ 
        background: 'linear-gradient(135deg, rgba(152, 175, 211, 0.15), rgba(152, 175, 211, 0.05))',
        borderColor: 'var(--accent)'
      }}>
        <h2 className="text-2xl font-semibold text-white mb-3">Ready to get started?</h2>
        <p className="max-w-md mx-auto mb-8" style={{ color: 'var(--text-secondary)' }}>
          Join thousands of users who trust Wisper Hub for their scripting needs.
        </p>
        {user ? (
          <Link 
            to="/dashboard" 
            className="btn btn-primary px-8 py-3"
          >
            Go to Dashboard
            <ArrowRight className="w-4 h-4" />
          </Link>
        ) : (
          <Link 
            to="/login" 
            className="btn btn-primary px-8 py-3"
          >
            Get Started
            <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </section>
    </div>
  )
}
