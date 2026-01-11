import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import AuthCallback from './pages/AuthCallback'
import DashboardPage from './pages/DashboardPage'
import CheckpointsPage from './pages/CheckpointsPage'
import CheckpointComplete from './pages/CheckpointComplete'
import StatusPage from './pages/StatusPage'
import ExecutorsPage from './pages/ExecutorsPage'
import AdminPage from './pages/AdminPage'
import AdminUsers from './pages/admin/AdminUsers'
import AdminScripts from './pages/admin/AdminScripts'
import AdminCheckpoints from './pages/admin/AdminCheckpoints'
import AdminSettings from './pages/admin/AdminSettings'
import AdminLogs from './pages/admin/AdminLogs'
import AdminLoaderErrors from './pages/admin/AdminLoaderErrors'
import AdminScriptPreview from './pages/admin/AdminScriptPreview'
import AdminSecurity from './pages/admin/AdminSecurity'

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (adminOnly && !user.isAdmin && !user.isOwner) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="auth/callback" element={<AuthCallback />} />
            <Route path="status" element={<StatusPage />} />
            <Route path="executors" element={<ExecutorsPage />} />
            
            <Route path="dashboard" element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            } />
            
            <Route path="checkpoints" element={
              <ProtectedRoute>
                <CheckpointsPage />
              </ProtectedRoute>
            } />
            
            <Route path="checkpoints/complete/:id" element={
              <ProtectedRoute>
                <CheckpointComplete />
              </ProtectedRoute>
            } />
            
            <Route path="checkpoint/complete" element={
              <ProtectedRoute>
                <CheckpointComplete />
              </ProtectedRoute>
            } />
            
            <Route path="admin" element={
              <ProtectedRoute adminOnly>
                <AdminPage />
              </ProtectedRoute>
            } />
            
            <Route path="admin/users" element={
              <ProtectedRoute adminOnly>
                <AdminUsers />
              </ProtectedRoute>
            } />
            
            <Route path="admin/scripts" element={
              <ProtectedRoute adminOnly>
                <AdminScripts />
              </ProtectedRoute>
            } />
            
            <Route path="admin/checkpoints" element={
              <ProtectedRoute adminOnly>
                <AdminCheckpoints />
              </ProtectedRoute>
            } />
            
            <Route path="admin/settings" element={
              <ProtectedRoute adminOnly>
                <AdminSettings />
              </ProtectedRoute>
            } />
            
            <Route path="admin/logs" element={
              <ProtectedRoute adminOnly>
                <AdminLogs />
              </ProtectedRoute>
            } />
            
            <Route path="admin/loader-errors" element={
              <ProtectedRoute adminOnly>
                <AdminLoaderErrors />
              </ProtectedRoute>
            } />
            
            <Route path="admin/scripts/:id/preview" element={
              <ProtectedRoute adminOnly>
                <AdminScriptPreview />
              </ProtectedRoute>
            } />
            
            <Route path="admin/security" element={
              <ProtectedRoute adminOnly>
                <AdminSecurity />
              </ProtectedRoute>
            } />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
