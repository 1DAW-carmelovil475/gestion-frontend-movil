import { createContext, useContext, useState, useEffect, useRef } from 'react'
import * as SecureStore from 'expo-secure-store'
import { apiFetch, API_URL } from '../services/api'
import { getTokenExp, tryRefreshToken } from '../services/auth-helpers'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)
  const refreshTimer          = useRef(null)

  function scheduleRefresh(token) {
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
    const exp = getTokenExp(token)
    if (!exp) return
    const delay = exp - Date.now() - 2 * 60 * 1000
    if (delay <= 0) { doRefresh(); return }
    refreshTimer.current = setTimeout(doRefresh, delay)
  }

  async function doRefresh() {
    const newToken = await tryRefreshToken()
    if (newToken) scheduleRefresh(newToken)
    else logout()
  }

  useEffect(() => {
    checkSession()
    return () => { if (refreshTimer.current) clearTimeout(refreshTimer.current) }
  }, [])

  async function checkSession() {
    const token = await SecureStore.getItemAsync('hola_token')
    if (!token) { setLoading(false); return }

    const exp = getTokenExp(token)
    if (exp && exp - Date.now() < 60 * 1000) {
      const newToken = await tryRefreshToken()
      if (!newToken) {
        await SecureStore.deleteItemAsync('hola_token')
        await SecureStore.deleteItemAsync('hola_refresh')
        setLoading(false)
        return
      }
      scheduleRefresh(newToken)
    } else {
      scheduleRefresh(token)
    }

    try {
      const userData = await apiFetch('/api/auth/me')
      setUser(userData)
    } catch {
      await SecureStore.deleteItemAsync('hola_token')
      await SecureStore.deleteItemAsync('hola_refresh')
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  async function login(email, password) {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Email o contraseña incorrectos.')

    await SecureStore.setItemAsync('hola_token', data.access_token)
    await SecureStore.setItemAsync('hola_refresh', data.refresh_token)
    scheduleRefresh(data.access_token)
    setUser(data.user)
    return data.user
  }

  async function logout() {
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
    await SecureStore.deleteItemAsync('hola_token')
    await SecureStore.deleteItemAsync('hola_refresh')
    setUser(null)
  }

  const isAdmin   = () => user?.rol === 'admin' || user?.rol === 'gestor'
  const isCliente = () => user?.rol === 'cliente'
  const isGestor  = () => user?.rol === 'gestor'

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin, isCliente, isGestor, checkSession }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
