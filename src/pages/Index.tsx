import React from 'react'
import { useAuth } from '@/context/AuthContext'
import { AuthScreen } from '@/components/AuthScreen'
import { DashboardPage } from './Dashboard'

export default function Index() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1A0E2E] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-white/70 text-xs font-semibold tracking-wider uppercase">
            Carregando Finanzze...
          </p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <AuthScreen />
  }

  return <DashboardPage />
}
