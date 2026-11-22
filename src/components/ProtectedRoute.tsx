import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { AuthScreen } from '@/components/AuthScreen'
import { LogoLoader } from '@/components/LogoLoader'

export const ProtectedRoute: React.FC = () => {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1A0E2E] flex items-center justify-center">
        <LogoLoader size={64} />
      </div>
    )
  }

  if (!user) {
    return <AuthScreen />
  }

  return <Outlet />
}
