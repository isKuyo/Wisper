const API_URL = import.meta.env.VITE_API_URL || 'https://api.wisper.lol/api'

class ApiService {
  constructor() {
    this.baseUrl = API_URL
  }

  getToken() {
    return localStorage.getItem('wisper_token')
  }

  setToken(token) {
    localStorage.setItem('wisper_token', token)
  }

  removeToken() {
    localStorage.removeItem('wisper_token')
  }

  async request(endpoint, options = {}) {
    const token = this.getToken()
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error?.message || 'Request failed')
    }

    return data
  }

  // Auth
  getDiscordAuthUrl() {
    return `${this.baseUrl}/auth/discord`
  }

  async getMe() {
    return this.request('/auth/me')
  }

  async logout() {
    return this.request('/auth/logout', { method: 'POST' })
  }

  // Keys
  async generateKey(hwid) {
    return this.request('/keys/generate', {
      method: 'POST',
      body: JSON.stringify({ hwid })
    })
  }

  async getMyKey() {
    return this.request('/keys/my-key')
  }

  async resetHwid() {
    return this.request('/keys/reset-hwid', { method: 'POST' })
  }

  async bindHwid(hwid) {
    return this.request('/keys/bind-hwid', {
      method: 'POST',
      body: JSON.stringify({ hwid })
    })
  }

  async extendKey() {
    return this.request('/keys/extend', { method: 'POST' })
  }

  // Checkpoints
  async getCheckpoints() {
    return this.request('/checkpoints')
  }

  async startCheckpoint(id) {
    return this.request(`/checkpoints/${id}/start`)
  }

  async completeCheckpoint(id, token, turnstileToken) {
    return this.request(`/checkpoints/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify({ token, turnstileToken })
    })
  }

  async getCheckpointStatus() {
    return this.request('/checkpoints/status')
  }

  // Admin - Users
  async getUsers(page = 1, limit = 50, search = '') {
    const params = new URLSearchParams({ page, limit })
    if (search) params.append('search', search)
    return this.request(`/admin/users?${params}`)
  }

  async getUser(id) {
    return this.request(`/admin/users/${id}`)
  }

  async resetUserHwid(id) {
    return this.request(`/admin/users/${id}/reset-hwid`, { method: 'POST' })
  }

  async banUser(id) {
    return this.request(`/admin/users/${id}/ban`, { method: 'POST' })
  }

  async unbanUser(id) {
    return this.request(`/admin/users/${id}/unban`, { method: 'POST' })
  }

  async makeAdmin(id) {
    return this.request(`/admin/users/${id}/make-admin`, { method: 'POST' })
  }

  async removeAdmin(id) {
    return this.request(`/admin/users/${id}/remove-admin`, { method: 'POST' })
  }

  async updateUserKey(id, data) {
    return this.request(`/admin/users/${id}/update-key`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  // Admin - Scripts
  async getScripts() {
    return this.request('/admin/scripts')
  }

  async getScript(id) {
    return this.request(`/admin/scripts/${id}`)
  }

  async createScript(data) {
    return this.request('/admin/scripts', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async updateScript(id, data) {
    return this.request(`/admin/scripts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }

  async deleteScript(id) {
    return this.request(`/admin/scripts/${id}`, { method: 'DELETE' })
  }

  async getScriptPreview(id, level = 'medium') {
    return this.request(`/admin/scripts/${id}/preview?level=${level}`)
  }

  async getRobloxGameInfo(placeId) {
    return this.request(`/admin/roblox/game/${placeId}`)
  }

  // Public - Status
  async getHubStatus() {
    return this.request('/auth/status')
  }

  // Admin - Checkpoints
  async getAdminCheckpoints() {
    return this.request('/admin/checkpoints')
  }

  async createCheckpoint(data) {
    return this.request('/admin/checkpoints', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async updateCheckpoint(id, data) {
    return this.request(`/admin/checkpoints/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }

  async deleteCheckpoint(id) {
    return this.request(`/admin/checkpoints/${id}`, { method: 'DELETE' })
  }

  // Admin - Settings
  async getSettings() {
    return this.request('/admin/settings')
  }

  async updateSettings(data) {
    return this.request('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }

  // Admin - Logs
  async getLogs(page = 1, limit = 100, event = '', userId = '') {
    const params = new URLSearchParams({ page, limit })
    if (event) params.append('event', event)
    if (userId) params.append('userId', userId)
    return this.request(`/admin/logs?${params}`)
  }

  // Admin - Stats
  async getStats() {
    return this.request('/admin/stats')
  }
}

export const api = new ApiService()
export default api
