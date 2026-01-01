import { useState, useEffect } from 'react'
import api from '../../services/api'
import { Link } from 'react-router-dom'
import { 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  Code,
  AlertCircle,
  CheckCircle,
  Gamepad2,
  Pause,
  Play,
  Wrench,
  RefreshCw,
  Search,
  Eye
} from 'lucide-react'

export default function AdminScripts() {
  const [scripts, setScripts] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [gamePreview, setGamePreview] = useState(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    placeId: '',
    gameId: '',
    content: '',
    enabled: true,
    paused: false,
    maintenance: false,
    maintenanceMessage: '',
    iconUrl: ''
  })

  useEffect(() => {
    loadScripts()
  }, [])

  const loadScripts = async () => {
    try {
      const data = await api.getScripts()
      setScripts(data.scripts)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchGamePreview = async (placeId) => {
    if (!placeId || placeId.length < 5) return
    setLoadingPreview(true)
    try {
      const data = await api.getRobloxGameInfo(placeId)
      setGamePreview(data.game)
      // Auto-fill name if empty
      if (!formData.name && data.game.name) {
        setFormData(prev => ({ ...prev, name: data.game.name }))
      }
    } catch (err) {
      setGamePreview(null)
    } finally {
      setLoadingPreview(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setError(null)
    
    try {
      await api.createScript({
        name: formData.name,
        placeId: parseInt(formData.placeId),
        gameId: formData.gameId ? parseInt(formData.gameId) : undefined,
        content: formData.content,
        enabled: formData.enabled,
        iconUrl: gamePreview?.iconUrl || formData.iconUrl || undefined
      })
      setSuccess('Script created successfully')
      setCreating(false)
      resetForm()
      setGamePreview(null)
      await loadScripts()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    setError(null)
    
    try {
      await api.updateScript(editing, {
        name: formData.name,
        content: formData.content,
        enabled: formData.enabled,
        paused: formData.paused,
        maintenance: formData.maintenance,
        maintenanceMessage: formData.maintenanceMessage || null
      })
      setSuccess('Script updated successfully')
      setEditing(null)
      resetForm()
      await loadScripts()
    } catch (err) {
      setError(err.message)
    }
  }

  const togglePaused = async (script) => {
    try {
      await api.updateScript(script.id, { paused: !script.paused })
      setSuccess(`Script ${script.paused ? 'resumed' : 'paused'}`)
      await loadScripts()
    } catch (err) {
      setError(err.message)
    }
  }

  const toggleEnabled = async (script) => {
    try {
      await api.updateScript(script.id, { enabled: !script.enabled })
      setSuccess(`Script ${script.enabled ? 'disabled' : 'enabled'}`)
      await loadScripts()
    } catch (err) {
      setError(err.message)
    }
  }

  const refreshIcon = async (script) => {
    try {
      const data = await api.getRobloxGameInfo(script.placeId)
      if (data.game?.iconUrl) {
        await api.updateScript(script.id, { iconUrl: data.game.iconUrl })
        setSuccess(`Icon updated for ${script.name}`)
        await loadScripts()
      } else {
        setError('Could not fetch icon from Roblox')
      }
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete script "${name}"? This cannot be undone.`)) return
    
    try {
      await api.deleteScript(id)
      setSuccess('Script deleted successfully')
      await loadScripts()
    } catch (err) {
      setError(err.message)
    }
  }

  const startEdit = async (script) => {
    try {
      const data = await api.getScript(script.id)
      setFormData({
        name: data.script.name,
        placeId: data.script.placeId,
        gameId: data.script.gameId || '',
        content: data.script.content,
        enabled: data.script.enabled,
        paused: data.script.paused || false,
        maintenance: data.script.maintenance || false,
        maintenanceMessage: data.script.maintenanceMessage || '',
        iconUrl: data.script.iconUrl || ''
      })
      setEditing(script.id)
      setCreating(false)
    } catch (err) {
      setError(err.message)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      placeId: '',
      gameId: '',
      content: '',
      enabled: true,
      paused: false,
      maintenance: false,
      maintenanceMessage: '',
      iconUrl: ''
    })
    setGamePreview(null)
  }

  const cancelEdit = () => {
    setEditing(null)
    setCreating(false)
    resetForm()
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Scripts</h1>
          <p className="text-dark-400">Manage game scripts</p>
        </div>
        
        {!creating && !editing && (
          <button
            onClick={() => { setCreating(true); resetForm(); }}
            className="btn btn-primary"
          >
            <Plus className="w-4 h-4" />
            Add Script
          </button>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400">
          <CheckCircle className="w-5 h-5" />
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Create/Edit Form */}
      {(creating || editing) && (
        <form onSubmit={editing ? handleUpdate : handleCreate} className="bg-[#111] border border-[#222] rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-6">
            {editing ? 'Edit Script' : 'Create New Script'}
          </h2>
          
          {/* Game Preview */}
          {creating && (
            <div className="mb-6">
              <label className="block text-sm text-[#888] mb-2">Place ID</label>
              <div className="flex gap-3">
                <input
                  type="number"
                  value={formData.placeId}
                  onChange={(e) => setFormData({ ...formData, placeId: e.target.value })}
                  className="flex-1 px-4 py-2.5 bg-[#0a0a0a] border border-[#333] rounded-lg text-white text-sm focus:outline-none focus:border-[#555]"
                  placeholder="e.g., 2753915549"
                  required
                />
                <button
                  type="button"
                  onClick={() => fetchGamePreview(formData.placeId)}
                  disabled={loadingPreview || !formData.placeId}
                  className="px-4 py-2.5 bg-[#1a1a1a] hover:bg-[#222] disabled:opacity-50 border border-[#333] rounded-lg text-sm text-white transition-colors flex items-center gap-2"
                >
                  {loadingPreview ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  Fetch
                </button>
              </div>
              
              {/* Game Preview Card */}
              {gamePreview && (
                <div className="mt-3 p-4 bg-[#0a0a0a] border border-[#333] rounded-lg flex items-center gap-4">
                  {gamePreview.iconUrl ? (
                    <img src={gamePreview.iconUrl} alt={gamePreview.name} className="w-16 h-16 rounded-lg" />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-[#1a1a1a] flex items-center justify-center">
                      <Gamepad2 className="w-8 h-8 text-[#444]" />
                    </div>
                  )}
                  <div>
                    <div className="text-white font-medium">{gamePreview.name}</div>
                    <div className="text-[#666] text-sm">Universe ID: {gamePreview.universeId}</div>
                  </div>
                  <CheckCircle className="w-5 h-5 text-green-400 ml-auto" />
                </div>
              )}
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm text-[#888] mb-2">Script Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2.5 bg-[#0a0a0a] border border-[#333] rounded-lg text-white text-sm focus:outline-none focus:border-[#555]"
                placeholder="e.g., Blox Fruits Script"
                required
              />
            </div>
            
            {editing && (
              <div>
                <label className="block text-sm text-[#888] mb-2">Place ID</label>
                <input
                  type="text"
                  value={formData.placeId}
                  className="w-full px-4 py-2.5 bg-[#0a0a0a] border border-[#333] rounded-lg text-[#666] text-sm"
                  disabled
                />
              </div>
            )}
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Enabled Toggle */}
            <div className="p-4 bg-[#0a0a0a] border border-[#333] rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white text-sm font-medium">Enabled</div>
                  <div className="text-[#666] text-xs mt-0.5">Script is active</div>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, enabled: !formData.enabled })}
                  className={`relative w-12 h-6 rounded-full transition-colors ${formData.enabled ? 'bg-green-500' : 'bg-[#333]'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${formData.enabled ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
            </div>

            {/* Paused Toggle */}
            <div className="p-4 bg-[#0a0a0a] border border-[#333] rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white text-sm font-medium">Paused</div>
                  <div className="text-[#666] text-xs mt-0.5">Temporarily paused</div>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, paused: !formData.paused })}
                  className={`relative w-12 h-6 rounded-full transition-colors ${formData.paused ? 'bg-yellow-500' : 'bg-[#333]'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${formData.paused ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
            </div>

            {/* Maintenance Toggle */}
            <div className="p-4 bg-[#0a0a0a] border border-[#333] rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white text-sm font-medium">Maintenance</div>
                  <div className="text-[#666] text-xs mt-0.5">Under maintenance</div>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, maintenance: !formData.maintenance })}
                  className={`relative w-12 h-6 rounded-full transition-colors ${formData.maintenance ? 'bg-orange-500' : 'bg-[#333]'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${formData.maintenance ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Maintenance Message */}
          {formData.maintenance && (
            <div className="mb-6">
              <label className="block text-sm text-[#888] mb-2">Maintenance Message</label>
              <input
                type="text"
                value={formData.maintenanceMessage}
                onChange={(e) => setFormData({ ...formData, maintenanceMessage: e.target.value })}
                className="w-full px-4 py-2.5 bg-[#0a0a0a] border border-[#333] rounded-lg text-white text-sm focus:outline-none focus:border-[#555]"
                placeholder="e.g., Updating script for new game version..."
              />
            </div>
          )}
          
          <div className="mb-6">
            <label className="block text-sm text-[#888] mb-2">Script Content (Lua)</label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#333] rounded-lg text-white text-sm font-mono focus:outline-none focus:border-[#555] h-64 resize-none"
              placeholder="-- Your Lua script here"
              required
            />
          </div>
          
          <div className="flex gap-3">
            <button type="submit" className="px-6 py-2.5 bg-white text-black hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
              <Save className="w-4 h-4" />
              {editing ? 'Update Script' : 'Create Script'}
            </button>
            <button type="button" onClick={cancelEdit} className="px-6 py-2.5 bg-[#1a1a1a] hover:bg-[#222] border border-[#333] rounded-lg text-sm text-white transition-colors flex items-center gap-2">
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Scripts List */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-[#111] border border-[#222] rounded-xl p-8 text-center">
            <div className="w-8 h-8 border-2 border-[#333] border-t-white rounded-full animate-spin mx-auto"></div>
          </div>
        ) : scripts.length === 0 ? (
          <div className="bg-[#111] border border-[#222] rounded-xl p-12 text-center">
            <Code className="w-12 h-12 text-[#444] mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No Scripts</h3>
            <p className="text-[#666]">Add your first game script to get started.</p>
          </div>
        ) : (
          scripts.map((script) => (
            <div key={script.id} className="bg-[#111] border border-[#222] rounded-xl p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  {/* Game Icon */}
                  {script.iconUrl ? (
                    <img src={script.iconUrl} alt={script.name} className="w-14 h-14 rounded-lg" />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-[#1a1a1a] flex items-center justify-center">
                      <Gamepad2 className="w-7 h-7 text-[#444]" />
                    </div>
                  )}
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-white">{script.name}</h3>
                      
                      {/* Status Badges */}
                      {script.maintenance ? (
                        <span className="px-2 py-0.5 text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded">Maintenance</span>
                      ) : script.paused ? (
                        <span className="px-2 py-0.5 text-xs bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded">Paused</span>
                      ) : script.enabled ? (
                        <span className="px-2 py-0.5 text-xs bg-green-500/10 text-green-400 border border-green-500/20 rounded">Active</span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs bg-red-500/10 text-red-400 border border-red-500/20 rounded">Disabled</span>
                      )}
                    </div>
                    
                    <div className="text-[#666] text-sm mt-1">
                      Place ID: <code className="text-[#888]">{script.placeId}</code>
                      {script.gameId && (
                        <> • Game ID: <code className="text-[#888]">{script.gameId}</code></>
                      )}
                    </div>
                    
                    <div className="text-[#444] text-xs mt-1">
                      v{script.version} • {new Date(script.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-2">
                  {/* Refresh Icon */}
                  {!script.iconUrl && (
                    <button
                      onClick={() => refreshIcon(script)}
                      className="p-2 bg-[#1a1a1a] hover:bg-blue-500/20 text-[#666] hover:text-blue-400 rounded-lg transition-colors"
                      title="Fetch Icon from Roblox"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  )}
                  
                  {/* Quick Toggle Pause */}
                  <button
                    onClick={() => togglePaused(script)}
                    className={`p-2 rounded-lg transition-colors ${
                      script.paused 
                        ? 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20' 
                        : 'bg-[#1a1a1a] text-[#666] hover:text-white hover:bg-[#222]'
                    }`}
                    title={script.paused ? 'Resume' : 'Pause'}
                  >
                    {script.paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  </button>
                  
                  {/* Quick Toggle Enable */}
                  <button
                    onClick={() => toggleEnabled(script)}
                    className={`p-2 rounded-lg transition-colors ${
                      script.enabled 
                        ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20' 
                        : 'bg-[#1a1a1a] text-[#666] hover:text-white hover:bg-[#222]'
                    }`}
                    title={script.enabled ? 'Disable' : 'Enable'}
                  >
                    {script.enabled ? <CheckCircle className="w-4 h-4" /> : <X className="w-4 h-4" />}
                  </button>
                  
                  {/* Preview Obfuscated */}
                  <Link
                    to={`/admin/scripts/${script.id}/preview`}
                    className="p-2 bg-[#1a1a1a] hover:bg-purple-500/20 text-[#888] hover:text-purple-400 rounded-lg transition-colors"
                    title="Preview Obfuscated"
                  >
                    <Eye className="w-4 h-4" />
                  </Link>
                  
                  {/* Edit */}
                  <button
                    onClick={() => startEdit(script)}
                    className="p-2 bg-[#1a1a1a] hover:bg-[#222] text-[#888] hover:text-white rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  
                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(script.id, script.name)}
                    className="p-2 bg-[#1a1a1a] hover:bg-red-500/20 text-[#888] hover:text-red-400 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
