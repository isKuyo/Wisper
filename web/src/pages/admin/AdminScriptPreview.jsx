import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../../services/api'
import { 
  ArrowLeft, 
  Code, 
  Eye, 
  Copy, 
  Check,
  RefreshCw,
  FileCode,
  Zap,
  Hash
} from 'lucide-react'

// Component to render code with line numbers
function CodeWithLineNumbers({ code, maxHeight = '384px' }) {
  const lines = useMemo(() => (code || '').split('\n'), [code])
  const lineCount = lines.length
  const lineNumberWidth = String(lineCount).length * 10 + 20
  
  return (
    <div 
      className="rounded-lg border border-[#222] overflow-auto"
      style={{ maxHeight, backgroundColor: '#0d0d0d' }}
    >
      <div className="flex min-w-max">
        {/* Line numbers column - sticky */}
        <div 
          className="sticky left-0 flex-shrink-0 text-right select-none border-r border-[#222] py-3 px-3"
          style={{ minWidth: lineNumberWidth, backgroundColor: '#0a0a0a', color: '#555' }}
        >
          {lines.map((_, i) => (
            <div key={i} className="text-xs font-mono leading-5 h-5">
              {i + 1}
            </div>
          ))}
        </div>
        {/* Code column */}
        <div className="flex-1 py-3 px-4">
          <pre className="text-sm font-mono" style={{ color: '#ccc' }}>
            {lines.map((line, i) => (
              <div key={i} className="leading-5 h-5 whitespace-pre">
                {line || ' '}
              </div>
            ))}
          </pre>
        </div>
      </div>
    </div>
  )
}

export default function AdminScriptPreview() {
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)
  const [level, setLevel] = useState('medium')
  const [copied, setCopied] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    loadPreview()
  }, [id, level])

  const loadPreview = async () => {
    try {
      setRefreshing(true)
      const result = await api.getScriptPreview(id, level)
      setData(result)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(type)
      setTimeout(() => setCopied(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card border-red-500/50">
        <p className="text-red-400">{error}</p>
        <Link to="/admin/scripts" className="btn btn-secondary mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Scripts
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin/scripts" className="btn btn-secondary btn-sm">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Eye className="w-6 h-6 text-primary-500" />
              Script Preview
            </h1>
            <p className="text-dark-400">{data?.script?.name} (Place ID: {data?.script?.placeId})</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Obfuscation Level Selector */}
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="input w-52"
          >
            <option value="light">Light</option>
            <option value="medium">Medium</option>
            <option value="heavy">Heavy</option>
            <option value="ultra">Ultra</option>
            <option value="compact">Compact (Single Line)</option>
            <option value="vm">VM (Maximum Protection)</option>
            <option value="luraph">Luraph Style</option>
          </select>
          
          <button 
            onClick={loadPreview} 
            className="btn btn-secondary"
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="panel p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <FileCode className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Original</p>
              <p className="text-lg font-bold text-white">{data?.original?.lines} lines</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{data?.original?.size} bytes</p>
            </div>
          </div>
        </div>
        
        <div className="panel p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Code className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Obfuscated</p>
              <p className="text-lg font-bold text-white">{data?.obfuscated?.lines} lines</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{data?.obfuscated?.size} bytes</p>
            </div>
          </div>
        </div>
        
        <div className="panel p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Size Ratio</p>
              <p className="text-lg font-bold text-white">{data?.obfuscated?.ratio}x</p>
            </div>
          </div>
        </div>
        
        <div className="panel p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
              <Eye className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Protection</p>
              <p className="text-lg font-bold text-white capitalize">{data?.obfuscated?.level}</p>
            </div>
          </div>
        </div>

        <div className="panel p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
              <Hash className="w-5 h-5 text-cyan-500" />
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Content Hash</p>
              <p className="text-sm font-mono text-white">{data?.original?.hash}</p>
            </div>
          </div>
        </div>

        <div className="panel p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Build ID</p>
              <p className="text-sm font-mono text-white">{data?.obfuscated?.buildId}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Payload Info */}
      {data?.obfuscated?.payloadBytes > 0 && (
        <div className="panel p-4" style={{ background: 'linear-gradient(135deg, rgba(152, 175, 211, 0.1), rgba(152, 175, 211, 0.05))' }}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
              <Code className="w-6 h-6 text-accent" />
            </div>
            <div>
              <p className="text-white font-medium">Payload Encriptado</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Seu script de <strong className="text-white">{data?.original?.size?.toLocaleString()}</strong> bytes foi encriptado em{' '}
                <strong className="text-accent">{data?.obfuscated?.payloadBytes?.toLocaleString()}</strong> bytes no array payload.
                {data?.original?.size && data?.obfuscated?.payloadBytes && (
                  <span className="ml-2 text-xs">
                    (overhead: +{((data.obfuscated.payloadBytes / data.original.size - 1) * 100).toFixed(0)}% devido à watermark e headers)
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Code Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Original Code */}
        <div className="panel p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2 text-white">
              <FileCode className="w-5 h-5 text-blue-500" />
              Original Code
              <span className="badge badge-info ml-2">
                {data?.original?.lines} lines
              </span>
            </h3>
            <button
              onClick={() => copyToClipboard(data?.original?.content, 'original')}
              className="btn btn-secondary btn-sm"
            >
              {copied === 'original' ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
          <CodeWithLineNumbers code={data?.original?.content} maxHeight="500px" />
        </div>

        {/* Obfuscated Code */}
        <div className="panel p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2 text-white">
              <Code className="w-5 h-5 text-purple-500" />
              Obfuscated Code
              <span className="badge badge-warning ml-2">
                {data?.obfuscated?.lines} lines
              </span>
            </h3>
            <button
              onClick={() => copyToClipboard(data?.obfuscated?.content, 'obfuscated')}
              className="btn btn-secondary btn-sm"
            >
              {copied === 'obfuscated' ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
          <CodeWithLineNumbers code={data?.obfuscated?.content} maxHeight="500px" />
        </div>
      </div>

      {/* Info Note */}
      <div className="panel p-4" style={{ borderColor: 'rgba(152, 175, 211, 0.3)' }}>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          <strong className="text-accent">Como funciona:</strong> O código obfuscado tem menos linhas porque seu script ({data?.original?.lines} linhas, {data?.original?.size} bytes) 
          é encriptado em um array de números em poucas linhas. O código final tem <strong>{data?.obfuscated?.size?.toLocaleString()} caracteres</strong> ({data?.obfuscated?.ratio}x maior que o original).
          Role até o final do código obfuscado para ver o array <code className="text-accent">payload</code> com os bytes encriptados do seu script.
        </p>
      </div>
    </div>
  )
}
