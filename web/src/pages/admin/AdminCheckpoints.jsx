import { useState, useEffect } from 'react'
import api from '../../services/api'
import { 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  CheckSquare,
  AlertCircle,
  CheckCircle,
  GripVertical
} from 'lucide-react'

export default function AdminCheckpoints() {
  const [checkpoints, setCheckpoints] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [formData, setFormData] = useState({
    order: 1,
    platform: 'linkvertise',
    url: '',
    name: '',
    enabled: true
  })

  const platforms = [
    { value: 'linkvertise', label: 'Linkvertise' },
    { value: 'lootlabs', label: 'LootLabs' },
    { value: 'workink', label: 'Work.ink' },
    { value: 'other', label: 'Other' }
  ]

  useEffect(() => {
    loadCheckpoints()
  }, [])

  const loadCheckpoints = async () => {
    try {
      const data = await api.getAdminCheckpoints()
      setCheckpoints(data.checkpoints)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setError(null)
    
    try {
      await api.createCheckpoint({
        order: parseInt(formData.order),
        platform: formData.platform,
        url: formData.url,
        name: formData.name || undefined,
        enabled: formData.enabled
      })
      setSuccess('Checkpoint created successfully')
      setCreating(false)
      resetForm()
      await loadCheckpoints()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    setError(null)
    
    try {
      await api.updateCheckpoint(editing, {
        order: parseInt(formData.order),
        platform: formData.platform,
        url: formData.url,
        name: formData.name || undefined,
        enabled: formData.enabled
      })
      setSuccess('Checkpoint updated successfully')
      setEditing(null)
      resetForm()
      await loadCheckpoints()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this checkpoint? User progress will be lost.')) return
    
    try {
      await api.deleteCheckpoint(id)
      setSuccess('Checkpoint deleted successfully')
      await loadCheckpoints()
    } catch (err) {
      setError(err.message)
    }
  }

  const startEdit = (checkpoint) => {
    setFormData({
      order: checkpoint.order,
      platform: checkpoint.platform,
      url: checkpoint.url,
      name: checkpoint.name || '',
      enabled: checkpoint.enabled
    })
    setEditing(checkpoint.id)
    setCreating(false)
  }

  const resetForm = () => {
    const nextOrder = checkpoints.length > 0 
      ? Math.max(...checkpoints.map(c => c.order)) + 1 
      : 1
    setFormData({
      order: nextOrder,
      platform: 'linkvertise',
      url: '',
      name: '',
      enabled: true
    })
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
          <h1 className="text-2xl font-bold">Checkpoints</h1>
          <p className="text-dark-400">Configure monetization checkpoints</p>
        </div>
        
        {!creating && !editing && (
          <button
            onClick={() => { setCreating(true); resetForm(); }}
            className="btn btn-primary"
          >
            <Plus className="w-4 h-4" />
            Add Checkpoint
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
        <form onSubmit={editing ? handleUpdate : handleCreate} className="card">
          <h2 className="text-lg font-semibold mb-4">
            {editing ? 'Edit Checkpoint' : 'Create New Checkpoint'}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="label">Order</label>
              <input
                type="number"
                value={formData.order}
                onChange={(e) => setFormData({ ...formData, order: e.target.value })}
                className="input"
                min="1"
                required
              />
            </div>
            
            <div>
              <label className="label">Platform</label>
              <select
                value={formData.platform}
                onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                className="input"
                required
              >
                {platforms.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            
            <div className="md:col-span-2">
              <label className="label">URL</label>
              <input
                type="url"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                className="input"
                placeholder="https://linkvertise.com/..."
                required
              />
            </div>
            
            <div>
              <label className="label">Name (Optional)</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input"
                placeholder="e.g., Step 1"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="enabled"
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-primary-500 focus:ring-primary-500"
              />
              <label htmlFor="enabled" className="text-sm">Enabled</label>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary">
              <Save className="w-4 h-4" />
              {editing ? 'Update' : 'Create'}
            </button>
            <button type="button" onClick={cancelEdit} className="btn btn-secondary">
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Checkpoints List */}
      <div className="space-y-2">
        {loading ? (
          <div className="card text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500 mx-auto"></div>
          </div>
        ) : checkpoints.length === 0 ? (
          <div className="card text-center py-12">
            <CheckSquare className="w-12 h-12 text-dark-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Checkpoints</h3>
            <p className="text-dark-400">Add checkpoints to enable monetization.</p>
          </div>
        ) : (
          checkpoints.map((checkpoint) => (
            <div 
              key={checkpoint.id} 
              className={`card flex items-center gap-4 ${!checkpoint.enabled ? 'opacity-50' : ''}`}
            >
              <div className="text-dark-500">
                <GripVertical className="w-5 h-5" />
              </div>
              
              <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center font-bold text-primary-400">
                {checkpoint.order}
              </div>
              
              <div className="flex-1">
                <div className="font-medium flex items-center gap-2">
                  {checkpoint.name || `Checkpoint ${checkpoint.order}`}
                  {checkpoint.enabled ? (
                    <span className="badge badge-success">Active</span>
                  ) : (
                    <span className="badge badge-danger">Disabled</span>
                  )}
                </div>
                <div className="text-dark-400 text-sm">
                  <span className="capitalize">{checkpoint.platform}</span>
                  <span className="mx-2">•</span>
                  <span className="text-dark-500 truncate max-w-xs inline-block align-bottom">
                    {checkpoint.url}
                  </span>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(checkpoint)}
                  className="btn btn-secondary py-1 px-2"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(checkpoint.id)}
                  className="btn btn-danger py-1 px-2"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Info */}
      <div className="card bg-dark-900/50">
        <h3 className="font-semibold mb-2">Platform Integration</h3>
        <p className="text-dark-400 text-sm mb-3">
          Each platform handles callbacks differently. The system will automatically append the callback URL to redirect users back after completion.
        </p>
        <ul className="text-dark-400 text-sm space-y-1">
          <li><strong>Linkvertise:</strong> Uses <code>?r=</code> parameter</li>
          <li><strong>LootLabs:</strong> Uses <code>?destination=</code> parameter</li>
          <li><strong>Work.ink:</strong> Uses <code>?url=</code> parameter</li>
        </ul>
      </div>
    </div>
  )
}
