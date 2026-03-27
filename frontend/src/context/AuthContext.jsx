import { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'
import { API_URL } from '../utils/constants'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('ti_user')
    const token = localStorage.getItem('ti_token')
    if (stored && token) {
      setUser(JSON.parse(stored))
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
    }
    setLoading(false)
  }, [])

  const login = async (username, password) => {
    const res = await axios.post(`${API_URL}/auth/login`, { username, password })
    const { token, user: userData } = res.data
    localStorage.setItem('ti_token', token)
    localStorage.setItem('ti_user', JSON.stringify(userData))
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
    setUser(userData)
    return userData
  }

  const logout = () => {
    localStorage.removeItem('ti_token')
    localStorage.removeItem('ti_user')
    delete axios.defaults.headers.common['Authorization']
    setUser(null)
  }

  const refreshUser = async () => {
    try {
      const res = await axios.get(`${API_URL}/auth/me`)
      const userData = res.data
      localStorage.setItem('ti_user', JSON.stringify(userData))
      setUser(userData)
      return userData
    } catch (_) {}
  }

  const hasRole = (...roles) => user && roles.includes(user.rol)
  const canEdit = () => hasRole('super_admin', 'agente_soporte')
  const isAdmin = () => hasRole('super_admin')

  return (
    <AuthContext.Provider value={{ user, login, logout, refreshUser, loading, hasRole, canEdit, isAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
