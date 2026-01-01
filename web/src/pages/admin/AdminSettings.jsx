import { useState, useEffect } from 'react'
import api from '../../services/api'
import { 
  Save, 
  AlertCircle,
  CheckCircle,
  Settings,
  RefreshCw
} from 'lucide-react'

export default function AdminSettings() {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const data = await api.getSettings()
      setSettings(data.settings)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      await api.updateSettings({
        hubName: settings.hubName || 'Wisper Hub',
        hubDescription: settings.hubDescription || null,
        checkpointsRequired: settings.checkpointsRequired || 0,
        keyActivationHours: settings.keyActivationHours || 6,
        maxHwidResets: settings.maxHwidResets || 2,
        keyExpirationDays: settings.keyExpirationDays || null,
        maintenanceMode: settings.maintenanceMode || false,
        maintenanceMessage: settings.maintenanceMessage || null,
        loaderVersion: settings.loaderVersion || null
      })
      setSuccess('Settings saved successfully')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-dark-400">Configure system settings</p>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400">
          <CheckCircle className="w-5 h-5" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* General Settings */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary-500" />
            General Settings
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Hub Name</label>
              <input
                type="text"
                value={settings?.hubName || ''}
                onChange={(e) => setSettings({ ...settings, hubName: e.target.value })}
                className="input"
                required
              />
            </div>
            
            <div>
              <label className="label">Loader Version</label>
              <input
                type="text"
                value={settings?.loaderVersion || ''}
                onChange={(e) => setSettings({ ...settings, loaderVersion: e.target.value })}
                className="input"
                placeholder="1.0.0"
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="label">Hub Description</label>
              <textarea
                value={settings?.hubDescription || ''}
                onChange={(e) => setSettings({ ...settings, hubDescription: e.target.value })}
                className="input h-24"
                placeholder="Optional description for your hub"
              />
            </div>
          </div>
        </div>

        {/* Key Settings */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Key Settings</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Checkpoints Required</label>
              <input
                type="number"
                value={settings?.checkpointsRequired || 0}
                onChange={(e) => setSettings({ ...settings, checkpointsRequired: parseInt(e.target.value) })}
                className="input"
                min="0"
              />
              <p className="text-dark-500 text-sm mt-1">
                Number of checkpoints users must complete
              </p>
            </div>
            
            <div>
              <label className="label">Key Activation Time (Hours)</label>
              <input
                type="number"
                value={settings?.keyActivationHours || 6}
                onChange={(e) => setSettings({ ...settings, keyActivationHours: parseInt(e.target.value) })}
                className="input"
                min="1"
              />
              <p className="text-dark-500 text-sm mt-1">
                How long the key stays active after completing checkpoints
              </p>
            </div>
            
            <div>
              <label className="label">HWID Resets per Period</label>
              <input
                type="number"
                value={settings?.maxHwidResets || 2}
                onChange={(e) => setSettings({ ...settings, maxHwidResets: parseInt(e.target.value) })}
                className="input"
                min="0"
              />
              <p className="text-dark-500 text-sm mt-1">
                Maximum HWID resets allowed per 12 hours
              </p>
            </div>
            
            <div>
              <label className="label">Key Expiration (Days)</label>
              <input
                type="number"
                value={settings?.keyExpirationDays || ''}
                onChange={(e) => setSettings({ ...settings, keyExpirationDays: e.target.value ? parseInt(e.target.value) : null })}
                className="input"
                min="1"
                placeholder="Never expires"
              />
              <p className="text-dark-500 text-sm mt-1">
                Leave empty for keys that never expire
              </p>
            </div>
          </div>
        </div>

        {/* Maintenance Mode */}
        <div className="bg-[#111] border border-[#222] rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-400" />
            Maintenance Mode
          </h2>
          
          <div className="space-y-6">
            {/* Hub-wide Maintenance Toggle */}
            <div className="p-4 bg-[#0a0a0a] border border-[#333] rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white font-medium">Hub Maintenance</div>
                  <div className="text-[#666] text-sm mt-0.5">Disable the entire hub for all users</div>
                </div>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, maintenanceMode: !settings?.maintenanceMode })}
                  className={`relative w-14 h-7 rounded-full transition-colors ${settings?.maintenanceMode ? 'bg-orange-500' : 'bg-[#333]'}`}
                >
                  <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${settings?.maintenanceMode ? 'left-8' : 'left-1'}`} />
                </button>
              </div>
            </div>
            
            {settings?.maintenanceMode && (
              <>
                <div>
                  <label className="block text-sm text-[#888] mb-2">Maintenance Message</label>
                  <textarea
                    value={settings?.maintenanceMessage || ''}
                    onChange={(e) => setSettings({ ...settings, maintenanceMessage: e.target.value })}
                    className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#333] rounded-lg text-white text-sm focus:outline-none focus:border-[#555] h-24 resize-none"
                    placeholder="Hub is currently under maintenance. Please try again later."
                  />
                </div>
                
                <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-orange-400 font-medium">Maintenance Active</div>
                      <div className="text-orange-400/70 text-sm mt-1">
                        Users will see a maintenance page and cannot use the loader. 
                        You can also set maintenance per-game in the Scripts section.
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
