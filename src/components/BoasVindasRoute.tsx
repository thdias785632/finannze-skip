import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { LogoLoader } from '@/components/LogoLoader'

const CHAVE_BOAS_VINDAS = 'quitafy-boas-vindas-vista'

/** Guarda a rota /boas-vindas: exige sessão e só permite uma visita por cadastro. */
export const BoasVindasRoute: React.FC = () => {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1A0E2E] flex items-center justify-center">
        <LogoLoader size={64} />
      </div>
    )
  }

  if (!user) return <Navigate to="/" replace />

  // Já viu nesta conta (marcador gravado logo após o cadastro)? Vai para o resumo.
  if (sessionStorage.getItem(CHAVE_BOAS_VINDAS) === user.id) {
    return <Navigate to="/resumo" replace />
  }

  sessionStorage.setItem(CHAVE_BOAS_VINDAS, user.id)
  void location.pathname

  return <Outlet />
}
