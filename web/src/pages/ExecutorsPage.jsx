import { useState, useEffect } from 'react'
import { 
  Monitor, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  ExternalLink,
  Search,
  Cpu,
  Shield,
  Key,
  Zap,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Calendar,
  Globe
} from 'lucide-react'

// APIs required by Wisper Hub loader (from loader.lua analysis)
const REQUIRED_APIS = {
  critical: [
    { name: 'request / http_request / syn.request', desc: 'HTTP requests for API communication', weight: 25 },
    { name: 'loadstring', desc: 'Execute downloaded scripts', weight: 20 },
  ],
  important: [
    { name: 'writefile', desc: 'Save key locally', weight: 10 },
    { name: 'readfile', desc: 'Load saved key', weight: 10 },
    { name: 'isfile', desc: 'Check if key file exists', weight: 5 },
    { name: 'delfile', desc: 'Delete invalid key', weight: 5 },
  ],
  optional: [
    { name: 'identifyexecutor', desc: 'Get executor name for HWID', weight: 5 },
    { name: 'gethwid / get_hwid', desc: 'Hardware ID for key binding', weight: 5 },
    { name: 'getgenv', desc: 'Global environment access', weight: 5 },
    { name: 'setclipboard', desc: 'Copy key to clipboard', weight: 5 },
    { name: 'rconsoleprint / printconsole', desc: 'Console output', weight: 5 },
  ]
}

// Calculate hub compatibility based on sUNC percentage
// Note: sUNC (Standardized UNC) tests these exact APIs, so high sUNC = high compatibility
function calculateCompatibility(executor) {
  let score = 0
  
  // sUNC directly tests the APIs we need (request, filesystem, loadstring, etc)
  // So sUNC percentage is the best indicator of compatibility
  const sunc = executor.suncPercentage
  const unc = executor.uncPercentage
  
  if (sunc != null && sunc <= 100) {
    // sUNC is the primary indicator (70% weight)
    score = sunc * 0.7
    
    // Bonus for being updated (15% weight)
    if (executor.updateStatus) {
      score += 15
    }
    
    // Bonus for high UNC as secondary confirmation (15% weight)
    if (unc != null && unc <= 100) {
      score += (unc / 100) * 15
    }
  } else if (unc != null && unc <= 100) {
    // Fallback to UNC if no sUNC (less accurate)
    score = unc * 0.6
    
    if (executor.updateStatus) {
      score += 15
    }
  } else {
    // No data - assume low compatibility
    score = executor.updateStatus ? 30 : 15
  }
  
  return Math.min(Math.round(score), 100)
}

function getCompatibilityColor(percentage) {
  if (percentage >= 80) return 'text-green-400'
  if (percentage >= 60) return 'text-yellow-400'
  if (percentage >= 40) return 'text-orange-400'
  return 'text-red-400'
}

function getCompatibilityBgColor(percentage) {
  if (percentage >= 80) return 'bg-green-500'
  if (percentage >= 60) return 'bg-yellow-500'
  if (percentage >= 40) return 'bg-orange-500'
  return 'bg-red-500'
}

function getCompatibilityLabel(percentage) {
  if (percentage >= 90) return 'Excellent'
  if (percentage >= 80) return 'Great'
  if (percentage >= 60) return 'Good'
  if (percentage >= 40) return 'Limited'
  return 'Poor'
}

export default function ExecutorsPage() {
  const [executors, setExecutors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('all') // all, free, paid, updated
  const [sortBy, setSortBy] = useState('compatibility') // compatibility, name, sunc
  const [expandedId, setExpandedId] = useState(null) // Track expanded executor

  useEffect(() => {
    fetchExecutors()
  }, [])

  const fetchExecutors = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Use our backend proxy to avoid CORS issues
      const response = await fetch('http://localhost:3001/api/executors')
      
      if (!response.ok) {
        throw new Error('Failed to fetch executors')
      }
      
      const data = await response.json()
      
      // Filter only Windows executors and add compatibility score
      const windowsExecutors = data
        .filter(ex => ex.platform === 'Windows' && !ex.hidden)
        .map(ex => ({
          ...ex,
          hubCompatibility: calculateCompatibility(ex)
        }))
      
      setExecutors(windowsExecutors)
    } catch (err) {
      console.error('Error fetching executors:', err)
      setError('Failed to load executors. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  // Filter and sort executors
  const filteredExecutors = executors
    .filter(ex => {
      // Search filter
      if (searchTerm && !ex.title.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false
      }
      
      // Type filter
      if (filter === 'free' && !ex.free) return false
      if (filter === 'paid' && ex.free) return false
      if (filter === 'updated' && !ex.updateStatus) return false
      if (filter === 'keyless' && (ex.keysystem || !ex.free)) return false // Keyless = free AND no key system
      
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'compatibility') {
        return b.hubCompatibility - a.hubCompatibility
      }
      if (sortBy === 'name') {
        return a.title.localeCompare(b.title)
      }
      if (sortBy === 'sunc') {
        return (b.suncPercentage || 0) - (a.suncPercentage || 0)
      }
      return 0
    })

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <section className="text-center py-10">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Cpu className="w-8 h-8 text-accent" />
          <h1 className="text-3xl font-semibold text-white">Executors</h1>
        </div>
        <p className="max-w-lg mx-auto" style={{ color: 'var(--text-secondary)' }}>
          Check which Roblox executors are compatible with Wisper Hub
        </p>
      </section>

      {/* Filters */}
      <div className="panel p-5">
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search executors..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-10"
          />
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { value: 'all', label: 'All' },
            { value: 'free', label: 'Free' },
            { value: 'paid', label: 'Paid' },
            { value: 'keyless', label: 'Keyless' },
            { value: 'updated', label: 'Updated' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              className={`px-4 py-2 text-xs rounded-lg font-medium transition-all ${
                filter === option.value
                  ? 'text-white'
                  : 'hover:text-white'
              }`}
              style={filter === option.value 
                ? { background: 'var(--accent)' } 
                : { background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }
              }
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Sort & Refresh */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Sort:</span>
            {[
              { value: 'compatibility', label: 'Compatibility' },
              { value: 'name', label: 'Name' },
              { value: 'sunc', label: 'sUNC' },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setSortBy(option.value)}
                className={`px-2 py-1 text-xs rounded transition-all ${
                  sortBy === option.value
                    ? 'text-accent'
                    : 'hover:text-white'
                }`}
                style={sortBy !== option.value ? { color: 'var(--text-muted)' } : {}}
              >
                {option.label}
              </button>
            ))}
          </div>

          <button
            onClick={fetchExecutors}
            disabled={loading}
            className="btn btn-ghost text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="stat-value">{executors.length}</div>
          <div className="stat-label">Total Executors</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-green-400">
            {executors.filter(e => e.hubCompatibility >= 80).length}
          </div>
          <div className="stat-label">Fully Compatible</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {executors.filter(e => e.free).length}
          </div>
          <div className="stat-label">Free Executors</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-yellow-400">
            {executors.filter(e => e.updateStatus).length}
          </div>
          <div className="stat-label">Currently Updated</div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="spinner"></div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-400">{error}</p>
          <button
            onClick={fetchExecutors}
            className="mt-4 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Executors List */}
      {!loading && !error && (
        <div className="space-y-2">
          {filteredExecutors.map((executor) => {
            const sunc = executor.suncPercentage != null && executor.suncPercentage <= 100 ? executor.suncPercentage : null
            const unc = executor.uncPercentage != null && executor.uncPercentage <= 100 ? executor.uncPercentage : null
            const isExpanded = expandedId === executor._id
            
            return (
              <div
                key={executor._id}
                className={`bg-[#111] rounded-lg border transition-all duration-200 ${isExpanded ? 'border-[#333]' : 'border-[#1a1a1a] hover:border-[#222]'}`}
              >
                {/* Main Row - Clickable */}
                <div 
                  className="flex items-center gap-4 p-3 cursor-pointer select-none"
                  onClick={() => setExpandedId(isExpanded ? null : executor._id)}
                >
                  {/* Status Indicator */}
                  <div className={`w-1 h-8 rounded-full flex-shrink-0 ${executor.updateStatus ? 'bg-green-500' : 'bg-red-500'}`} />
                  
                  {/* Name & Version */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium truncate">{executor.title}</span>
                      <span className="text-[#444] text-xs">{executor.version}</span>
                    </div>
                  </div>

                  {/* Quick Tags */}
                  <div className="hidden sm:flex items-center gap-1.5">
                    <span className={`px-1.5 py-0.5 text-[10px] rounded ${executor.free ? 'bg-green-500/10 text-green-400' : 'bg-purple-500/10 text-purple-400'}`}>
                      {executor.free ? 'FREE' : 'PAID'}
                    </span>
                    {executor.detected === false && (
                      <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] rounded">UD</span>
                    )}
                  </div>

                  {/* Compatibility Bar */}
                  <div className="w-24 sm:w-32 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                        <div
                          className={`h-full ${getCompatibilityBgColor(executor.hubCompatibility)}`}
                          style={{ width: `${executor.hubCompatibility}%` }}
                        />
                      </div>
                      <span className={`text-xs font-medium w-8 text-right ${getCompatibilityColor(executor.hubCompatibility)}`}>
                        {executor.hubCompatibility}%
                      </span>
                    </div>
                  </div>

                  {/* Expand Icon */}
                  <div className="text-[#444]">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>

                {/* Expanded Details */}
                <div 
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}
                >
                  <div className="px-4 pb-4 pt-1 border-t border-[#1a1a1a]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                      {/* Left Column - Info */}
                      <div className="space-y-3">
                        {/* Status */}
                        <div className="flex items-center gap-2">
                          {executor.updateStatus ? (
                            <span className="flex items-center gap-1.5 text-green-400 text-sm">
                              <CheckCircle className="w-4 h-4" />
                              Updated
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-red-400 text-sm">
                              <XCircle className="w-4 h-4" />
                              Outdated
                            </span>
                          )}
                          {executor.updatedDate && (
                            <span className="text-[#444] text-xs flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {executor.updatedDate}
                            </span>
                          )}
                        </div>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-1.5">
                          <span className={`px-2 py-0.5 text-xs rounded ${executor.free ? 'bg-green-500/15 text-green-400' : 'bg-purple-500/15 text-purple-400'}`}>
                            {executor.free ? 'Free' : executor.cost || 'Paid'}
                          </span>
                          {executor.keysystem && (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/15 text-yellow-400 text-xs rounded">
                              <Key className="w-3 h-3" />
                              Key System
                            </span>
                          )}
                          {!executor.keysystem && executor.free && (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-sky-500/15 text-sky-400 text-xs rounded">
                              <Zap className="w-3 h-3" />
                              Keyless
                            </span>
                          )}
                          {executor.detected === false && (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/15 text-emerald-400 text-xs rounded">
                              <Shield className="w-3 h-3" />
                              Undetected
                            </span>
                          )}
                          {executor.decompiler && (
                            <span className="px-2 py-0.5 bg-[#1a1a1a] text-[#666] text-xs rounded">Decompiler</span>
                          )}
                          {executor.multiInject && (
                            <span className="px-2 py-0.5 bg-[#1a1a1a] text-[#666] text-xs rounded">Multi-Inject</span>
                          )}
                        </div>

                        {/* UNC Stats */}
                        {(sunc !== null || unc !== null) && (
                          <div className="flex gap-4">
                            {sunc !== null && (
                              <div>
                                <span className="text-[#444] text-xs">sUNC</span>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <div className="w-16 h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                                    <div className={`h-full ${sunc >= 80 ? 'bg-green-500' : sunc >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${sunc}%` }} />
                                  </div>
                                  <span className={`text-xs ${sunc >= 80 ? 'text-green-400' : sunc >= 50 ? 'text-yellow-400' : 'text-[#666]'}`}>{sunc}%</span>
                                </div>
                              </div>
                            )}
                            {unc !== null && (
                              <div>
                                <span className="text-[#444] text-xs">UNC</span>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <div className="w-16 h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                                    <div className={`h-full ${unc >= 80 ? 'bg-green-500' : unc >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${unc}%` }} />
                                  </div>
                                  <span className={`text-xs ${unc >= 80 ? 'text-green-400' : unc >= 50 ? 'text-yellow-400' : 'text-[#666]'}`}>{unc}%</span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Right Column - Compatibility & Links */}
                      <div className="space-y-3">
                        {/* Hub Compatibility */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[#666] text-xs">Hub Compatibility (based on sUNC)</span>
                            <span className={`text-sm font-medium ${getCompatibilityColor(executor.hubCompatibility)}`}>
                              {executor.hubCompatibility}% - {getCompatibilityLabel(executor.hubCompatibility)}
                            </span>
                          </div>
                          <div className="h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
                            <div
                              className={`h-full ${getCompatibilityBgColor(executor.hubCompatibility)} transition-all`}
                              style={{ width: `${executor.hubCompatibility}%` }}
                            />
                          </div>
                          <p className="text-[#444] text-[10px] mt-1">
                            sUNC tests: request, loadstring, filesystem, getgenv, etc.
                          </p>
                        </div>

                        {/* Links */}
                        <div className="flex gap-2">
                          {executor.websitelink && (
                            <a
                              href={executor.websitelink}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1a] hover:bg-[#222] text-[#888] hover:text-white text-xs rounded-lg transition-colors"
                            >
                              <Globe className="w-3.5 h-3.5" />
                              Website
                            </a>
                          )}
                          {executor.discordlink && (
                            <a
                              href={executor.discordlink}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-2 px-3 py-1.5 bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs rounded-lg transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.36-.698.772-1.362 1.225-1.993a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.12-.098.246-.198.373-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                              </svg>
                              Discord
                            </a>
                          )}
                          {executor.purchaselink && !executor.free && (
                            <a
                              href={executor.purchaselink}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 text-xs rounded-lg transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Purchase
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* No Results */}
      {!loading && !error && filteredExecutors.length === 0 && (
        <div className="text-center py-20">
          <Monitor className="w-16 h-16 text-[#333] mx-auto mb-4" />
          <p className="text-[#666]">No executors found matching your criteria</p>
        </div>
      )}

      {/* API Credit */}
      <div className="text-center text-[#444] text-sm">
        Data provided by{' '}
        <a
          href="https://whatexpsare.online/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#666] hover:text-white hover:underline"
        >
          WhatExpsAre.Online (WEAO)
        </a>
      </div>
    </div>
  )
}
