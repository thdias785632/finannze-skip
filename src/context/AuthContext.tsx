import React, { createContext, useContext, useEffect, useState } from 'react'
import { authService } from '@/services/auth'
import type { User, UserPlan } from '@/types/financial'
import { planoAbaixoDe } from '@/lib/planos'
import pb from '@/lib/pocketbase/client'

interface AuthContextType {
  user: User | null
  loading: boolean
  plan: UserPlan
  canAccessRecurring: boolean
  canAccessFutureExtract: boolean
  canAccessImoveis: boolean
  login: (email: string, pass: string) => Promise<User>
  signup: (name: string, email: string, pass: string, telefone: string) => Promise<User>
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

  const plan: UserPlan = user?.plan || 'basico'
  const canAccessRecurring = planoAbaixoDe(plan, 'bronze') === false
  const canAccessFutureExtract = planoAbaixoDe(plan, 'bronze') === false
  const canAccessImoveis = plan === 'ouro'

  // Não alteram o `loading` global: ele esconde a tela de autenticação (Index/ProtectedRoute)
  // e desmontaria o formulário, perdendo o que foi digitado e a mensagem de erro.
  const login = async (email: string, pass: string) => {
    const logged = await authService.login(email, pass)
    setUser(logged)
    return logged
  }

  const signup = async (name: string, email: string, pass: string, telefone: string) => {
    const created = await authService.signup(name, email, pass, telefone)
    setUser(created)
    return created
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
