import React from 'react'
import { useAuth } from '@/context/AuthContext'
import { useVerComoCliente } from '@/context/VerComoClienteContext'
import { AuthScreen } from '@/components/AuthScreen'
import { LogoLoader } from '@/components/LogoLoader'
import { DashboardPage } from './Dashboard'
import { AdminLayout } from '@/components/AdminNav'
import { AdminDashboard } from './admin/AdminDashboard'
import { Navigate } from 'react-router-dom'

export default function Index() {
  const { user, loading } = useAuth()
  const { verComoCliente } = useVerComoCliente()

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1A0E2E] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <LogoLoader size={64} />
          <p className="text-white/70 text-xs font-semibold tracking-wider uppercase">
            Carregando Quitafy...
          </p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <AuthScreen />
  }

  // Admin em modo admin cai direto no painel (interface separada do cliente).
  if (user.is_admin && !verComoCliente) {
    return (
      <AdminLayout>
        <AdminDashboard />
      </AdminLayout>
    )
  }

  return <DashboardPage />
}
