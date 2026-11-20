import React, { createContext, useContext, useEffect, useState } from 'react'
import { authService } from '@/services/auth'
import type { User, UserPlan } from '@/types/financial'
import pb from '@/lib/pocketbase/client'

interface AuthContextType {
  user: User | null
  loading: boolean
  plan: UserPlan
  canAccessRecurring: boolean
  canAccessFutureExtract: boolean
  canAccessImoveis: boolean
  login: (email: string, pass: string) => Promise<User>
  signup: (name: string, email: string, pass: string) => Promise<User>
  logout: () => void
  refresh: () => Promise<void>
  // Permite simulação/ativação para teste direto na interface caso desejado
  devSwitchPlan?: (plan: UserPlan) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(authService.getCurrentUser())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Listener do PocketBase authStore
    const unsubscribe = pb.authStore.onChange(() => {
      setUser(authService.getCurrentUser())
    })

    // Valida/atualiza sessão inicial
    authService
      .refreshUser()
      .then((u) => {
        setUser(u)
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })

    return () => {
      unsubscribe()
    }
  }, [])

  const plan: UserPlan = user?.plan || 'free'
  const canAccessRecurring = plan === 'vip' || plan === 'premium'
  const canAccessFutureExtract = plan === 'vip' || plan === 'premium'
  const canAccessImoveis = plan === 'premium'

  const login = async (email: string, pass: string) => {
    setLoading(true)
    try {
      const logged = await authService.login(email, pass)
      setUser(logged)
      return logged
    } finally {
      setLoading(false)
    }
  }

  const signup = async (name: string, email: string, pass: string) => {
    setLoading(true)
    try {
      const created = await authService.signup(name, email, pass)
      setUser(created)
      return created
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    authService.logout()
    setUser(null)
  }

  const refresh = async () => {
    const updated = await authService.refreshUser()
    setUser(updated)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        plan,
        canAccessRecurring,
        canAccessFutureExtract,
        canAccessImoveis,
        login,
        signup,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
