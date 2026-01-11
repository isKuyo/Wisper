import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import api from '../../services/api'
import { 
  Search, 
  RefreshCw, 
  Ban, 
  CheckCircle, 
  Shield, 
  ShieldOff,
  Key,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  X,
  Eye,
  Clock,
  Monitor,
  Gamepad2,
  Copy,
  Plus,
  Infinity,
  Trash2
} from 'lucide-react'

export default function AdminUsers() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [actionLoading, setActionLoading] = useState(null)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)
  const [userDetails, setUserDetails] = useState(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [keyAction, setKeyAction] = useState({ type: '', hours: 6, days: 1 })

  useEffect(() => {
    loadUsers()
  }, [pagination.page])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const data = await api.getUsers(pagination.page, 20, search)
      setUsers(data.users)
      setPagination(data.pagination)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setPagination(p => ({ ...p, page: 1 }))
    loadUsers()
  }

  const handleAction = async (action, userId, userName) => {
    setActionLoading(userId)
    setError(null)
    setSuccess(null)

    try {
      switch (action) {
        case 'resetHwid':
          await api.resetUserHwid(userId)
          setSuccess(`HWID reset for ${userName}`)
          break
        case 'ban':
          if (!confirm(`Are you sure you want to ban ${userName}?`)) return
          await api.banUser(userId)
          setSuccess(`${userName} has been banned`)
          break
        case 'unban':
          await api.unbanUser(userId)
          setSuccess(`${userName} has been unbanned`)
          break
        case 'makeAdmin':
          if (!confirm(`Make ${userName} an admin?`)) return
          await api.makeAdmin(userId)
          setSuccess(`${userName} is now an admin`)
          break
        case 'removeAdmin':
          if (!confirm(`Remove admin from ${userName}?`)) return
          await api.removeAdmin(userId)
          setSuccess(`Admin removed from ${userName}`)
          break
      }
      await loadUsers()
      if (selectedUser) await loadUserDetails(selectedUser.id)
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const loadUserDetails = async (userId) => {
    setDetailsLoading(true)
    try {
      const data = await api.getUser(userId)
      setUserDetails(data.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setDetailsLoading(false)
    }
  }

  const openUserDetails = async (user) => {
    setSelectedUser(user)
    await loadUserDetails(user.id)
  }

  const closeUserDetails = () => {
    setSelectedUser(null)
    setUserDetails(null)
    setKeyAction({ type: '', hours: 6, days: 1 })
  }

  const handleKeyAction = async () => {
    if (!userDetails || !keyAction.type) return
    setActionLoading('key')
    setError(null)

    try {
      if (keyAction.type === 'delete') {
        if (!confirm(`Are you sure you want to DELETE ${userDetails.username}'s key? They will need to complete checkpoints again.`)) {
          setActionLoading(null)
          return
        }
        await api.deleteUserKey(userDetails.id)
        setSuccess(`Key deleted successfully`)
      } else {
        await api.updateUserKey(userDetails.id, {
          action: keyAction.type,
          hours: keyAction.hours,
          days: keyAction.days
        })
        setSuccess(`Key updated successfully`)
      }
      await loadUserDetails(userDetails.id)
      await loadUsers()
      setKeyAction({ type: '', hours: 6, days: 1 })
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    setSuccess('Copied to clipboard!')
    setTimeout(() => setSuccess(null), 2000)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Users</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Manage all registered users</p>
        </div>
        
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users..."
              className="input pl-10"
            />
          </div>
          <button type="submit" className="btn btn-primary">
            Search
          </button>
        </form>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400">
          <CheckCircle className="w-5 h-5" />
          <span>{success}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="panel overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border)' }}>
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>User</th>
                <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Key</th>
                <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Checkpoints</th>
                <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Status</th>
                <th className="text-right px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Actions</th>
              </tr>
            </thead>
            <tbody style={{ borderColor: 'var(--border)' }} className="divide-y divide-[#27272a]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                    <div className="spinner mx-auto mb-2"></div>
                    Loading...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-dark-800/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {user.avatar ? (
                          <img
                            src={`https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png`}
                            alt=""
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-dark-700 flex items-center justify-center">
                            {user.username[0]}
                          </div>
                        )}
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {user.username}
                            {user.isOwner && <span className="badge badge-warning">Owner</span>}
                            {user.isAdmin && !user.isOwner && <span className="badge badge-info">Admin</span>}
                          </div>
                          <div className="text-dark-500 text-sm">{user.discordId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {user.key ? (
                        <div>
                          <code className="text-sm text-primary-400">{user.key.key}</code>
                          <div className="text-dark-500 text-xs mt-1">
                            HWID: {user.key.hwidBound ? 'Bound' : 'Not bound'}
                          </div>
                        </div>
                      ) : (
                        <span className="text-dark-500">No key</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-dark-300">{user.checkpointsCompleted}</span>
                    </td>
                    <td className="px-4 py-3">
                      {user.isBanned ? (
                        <span className="badge badge-danger">Banned</span>
                      ) : (
                        <span className="badge badge-success">Active</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openUserDetails(user)}
                          className="btn btn-primary text-sm py-1 px-2"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        
                        {user.key?.hwidBound && (
                          <button
                            onClick={() => handleAction('resetHwid', user.id, user.username)}
                            disabled={actionLoading === user.id}
                            className="btn btn-secondary text-sm py-1 px-2"
                            title="Reset HWID"
                          >
                            <Key className="w-4 h-4" />
                          </button>
                        )}
                        
                        {!user.isOwner && (
                          <>
                            {user.isBanned ? (
                              <button
                                onClick={() => handleAction('unban', user.id, user.username)}
                                disabled={actionLoading === user.id}
                                className="btn btn-secondary text-sm py-1 px-2"
                                title="Unban"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleAction('ban', user.id, user.username)}
                                disabled={actionLoading === user.id}
                                className="btn btn-danger text-sm py-1 px-2"
                                title="Ban"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            )}

                            {currentUser?.isOwner && (
                              user.isAdmin ? (
                                <button
                                  onClick={() => handleAction('removeAdmin', user.id, user.username)}
                                  disabled={actionLoading === user.id}
                                  className="btn btn-secondary text-sm py-1 px-2"
                                  title="Remove Admin"
                                >
                                  <ShieldOff className="w-4 h-4" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleAction('makeAdmin', user.id, user.username)}
                                  disabled={actionLoading === user.id}
                                  className="btn btn-secondary text-sm py-1 px-2"
                                  title="Make Admin"
                                >
                                  <Shield className="w-4 h-4" />
                                </button>
                              )
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-dark-800">
            <span className="text-dark-400 text-sm">
              Page {pagination.page} of {pagination.pages} ({pagination.total} users)
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                disabled={pagination.page <= 1}
                className="btn btn-secondary py-1 px-2"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                disabled={pagination.page >= pagination.pages}
                className="btn btn-secondary py-1 px-2"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center gap-3">
                {selectedUser.avatar ? (
                  <img
                    src={`https://cdn.discordapp.com/avatars/${selectedUser.discordId}/${selectedUser.avatar}.png`}
                    alt=""
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-dark-700 flex items-center justify-center text-lg">
                    {selectedUser.username[0]}
                  </div>
                )}
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    {selectedUser.username}
                    {selectedUser.isOwner && <span className="badge badge-warning">Owner</span>}
                    {selectedUser.isAdmin && !selectedUser.isOwner && <span className="badge badge-info">Admin</span>}
                  </h2>
                  <p className="text-dark-400 text-sm">{selectedUser.discordId}</p>
                </div>
              </div>
              <button onClick={closeUserDetails} className="btn btn-secondary p-2">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 space-y-6">
              {detailsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-8 h-8 animate-spin text-primary-500" />
                </div>
              ) : userDetails ? (
                <>
                  {/* Key Information */}
                  {userDetails.key ? (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Key className="w-5 h-5 text-primary-500" />
                        Key Information
                      </h3>
                      
                      {/* Full Key */}
                      <div className="bg-dark-800 rounded-lg p-4">
                        <div className="text-dark-400 text-sm mb-1">Full Key</div>
                        <div className="flex items-center gap-2">
                          <code className="text-primary-400 font-mono text-lg flex-1">{userDetails.key.key}</code>
                          <button
                            onClick={() => copyToClipboard(userDetails.key.key)}
                            className="btn btn-secondary p-2"
                            title="Copy"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Key Stats Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-dark-800 rounded-lg p-3">
                          <div className="text-dark-400 text-xs mb-1">Status</div>
                          <div className={`font-medium ${userDetails.key.isActive && !userDetails.key.isExpired ? 'text-green-400' : 'text-red-400'}`}>
                            {userDetails.key.isExpired ? 'Expired' : userDetails.key.isActive ? 'Active' : 'Revoked'}
                          </div>
                        </div>
                        <div className="bg-dark-800 rounded-lg p-3">
                          <div className="text-dark-400 text-xs mb-1">Expiration</div>
                          <div className="font-medium">
                            {userDetails.key.isPermanent ? (
                              <span className="text-green-400">∞ Permanent</span>
                            ) : userDetails.key.timeRemaining ? (
                              <span className="text-primary-400">
                                {userDetails.key.timeRemaining.days}d {userDetails.key.timeRemaining.hours}h {userDetails.key.timeRemaining.minutes}m
                              </span>
                            ) : (
                              <span className="text-red-400">Expired</span>
                            )}
                          </div>
                        </div>
                        <div className="bg-dark-800 rounded-lg p-3">
                          <div className="text-dark-400 text-xs mb-1">HWID Resets</div>
                          <div className="font-medium">{userDetails.key.hwidResetCount || 0}</div>
                        </div>
                        <div className="bg-dark-800 rounded-lg p-3">
                          <div className="text-dark-400 text-xs mb-1">Created</div>
                          <div className="font-medium text-sm">
                            {new Date(userDetails.key.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      {/* HWID Info */}
                      <div className="bg-dark-800 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-dark-400 text-sm mb-2">
                          <Gamepad2 className="w-4 h-4" />
                          HWID (Full)
                        </div>
                        {userDetails.key.hwidHash ? (
                          <div className="flex items-center gap-2">
                            <code className="text-sm font-mono text-yellow-400 flex-1 break-all">
                              {userDetails.key.hwidHash}
                            </code>
                            <button
                              onClick={() => copyToClipboard(userDetails.key.hwidHash)}
                              className="btn btn-secondary p-2"
                              title="Copy"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-dark-500">Not bound</span>
                        )}
                      </div>

                      {/* Executor Info */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="bg-dark-800 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-dark-400 text-xs mb-1">
                            <Monitor className="w-3 h-3" />
                            Last Executor
                          </div>
                          <div className="font-medium truncate">
                            {userDetails.key.lastExecutor || <span className="text-dark-500">-</span>}
                          </div>
                        </div>
                        <div className="bg-dark-800 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-dark-400 text-xs mb-1">
                            <Gamepad2 className="w-3 h-3" />
                            Last Game ID
                          </div>
                          <div className="font-medium">
                            {userDetails.key.lastPlaceId || <span className="text-dark-500">-</span>}
                          </div>
                        </div>
                        <div className="bg-dark-800 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-dark-400 text-xs mb-1">
                            <Clock className="w-3 h-3" />
                            Last Used
                          </div>
                          <div className="font-medium text-sm">
                            {userDetails.key.lastUsedAt 
                              ? new Date(userDetails.key.lastUsedAt).toLocaleString()
                              : <span className="text-dark-500">Never</span>
                            }
                          </div>
                        </div>
                      </div>

                      {/* Key Actions */}
                      <div className="bg-dark-800 rounded-lg p-4">
                        <h4 className="font-medium mb-3">Key Actions</h4>
                        <div className="flex flex-wrap gap-2 mb-3">
                          <button
                            onClick={() => setKeyAction({ ...keyAction, type: 'add_hours' })}
                            className={`btn ${keyAction.type === 'add_hours' ? 'btn-primary' : 'btn-secondary'} text-sm`}
                          >
                            <Plus className="w-4 h-4" /> Add Hours
                          </button>
                          <button
                            onClick={() => setKeyAction({ ...keyAction, type: 'add_days' })}
                            className={`btn ${keyAction.type === 'add_days' ? 'btn-primary' : 'btn-secondary'} text-sm`}
                          >
                            <Plus className="w-4 h-4" /> Add Days
                          </button>
                          <button
                            onClick={() => setKeyAction({ ...keyAction, type: 'set_permanent' })}
                            className={`btn ${keyAction.type === 'set_permanent' ? 'btn-primary' : 'btn-secondary'} text-sm`}
                          >
                            <Infinity className="w-4 h-4" /> Set Permanent
                          </button>
                          <button
                            onClick={() => setKeyAction({ ...keyAction, type: userDetails.key.isActive ? 'revoke' : 'activate' })}
                            className={`btn ${keyAction.type === 'revoke' || keyAction.type === 'activate' ? 'btn-danger' : 'btn-secondary'} text-sm`}
                          >
                            {userDetails.key.isActive ? (
                              <><Trash2 className="w-4 h-4" /> Revoke</>
                            ) : (
                              <><CheckCircle className="w-4 h-4" /> Activate</>
                            )}
                          </button>
                          <button
                            onClick={() => setKeyAction({ ...keyAction, type: 'delete' })}
                            className={`btn ${keyAction.type === 'delete' ? 'btn-danger' : 'btn-secondary'} text-sm`}
                          >
                            <Trash2 className="w-4 h-4" /> Delete Key
                          </button>
                        </div>

                        {/* Input for hours/days */}
                        {(keyAction.type === 'add_hours' || keyAction.type === 'add_days') && (
                          <div className="flex items-center gap-2 mb-3">
                            <input
                              type="number"
                              min="1"
                              value={keyAction.type === 'add_hours' ? keyAction.hours : keyAction.days}
                              onChange={(e) => setKeyAction({
                                ...keyAction,
                                [keyAction.type === 'add_hours' ? 'hours' : 'days']: parseInt(e.target.value) || 1
                              })}
                              className="input w-24"
                            />
                            <span className="text-dark-400">
                              {keyAction.type === 'add_hours' ? 'hours' : 'days'}
                            </span>
                          </div>
                        )}

                        {keyAction.type && (
                          <button
                            onClick={handleKeyAction}
                            disabled={actionLoading === 'key'}
                            className="btn btn-primary"
                          >
                            {actionLoading === 'key' ? (
                              <><RefreshCw className="w-4 h-4 animate-spin" /> Processing...</>
                            ) : (
                              'Apply Action'
                            )}
                          </button>
                        )}
                      </div>

                      {/* Reset HWID */}
                      {userDetails.key.hwidBound && (
                        <button
                          onClick={() => handleAction('resetHwid', userDetails.id, userDetails.username)}
                          disabled={actionLoading === userDetails.id}
                          className="btn btn-secondary w-full"
                        >
                          <Key className="w-4 h-4" /> Reset HWID
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-dark-400">
                      <Key className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>This user has no key</p>
                    </div>
                  )}

                  {/* Checkpoints Progress */}
                  {userDetails.checkpointProgress?.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3">Checkpoints Completed</h3>
                      <div className="space-y-2">
                        {userDetails.checkpointProgress.map((cp) => (
                          <div key={cp.id} className="bg-dark-800 rounded-lg p-3 flex items-center justify-between">
                            <span>{cp.checkpoint?.name || `Checkpoint ${cp.checkpointId}`}</span>
                            <span className="text-dark-400 text-sm">
                              {new Date(cp.completedAt).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-dark-400">
                  Failed to load user details
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
