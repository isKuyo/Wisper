import { createContext, useContext, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const token = api.getToken()
    if (!token) {
      setLoading(false)
      return
    }

    try {
      const data = await api.getMe()
      setUser(data.user)
    } catch (error) {
      console.error('Auth check failed:', error)
      api.removeToken()
    } finally {
      setLoading(false)
    }
  }

  const login = (token) => {
    api.setToken(token)
    checkAuth()
  }

  const logout = async () => {
    try {
      await api.logout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      api.removeToken()
      setUser(null)
    }
  }

  const refreshUser = async () => {
    try {
      const data = await api.getMe()
      setUser(data.user)
    } catch (error) {
      console.error('Refresh user failed:', error)
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
