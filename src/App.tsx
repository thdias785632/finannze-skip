import { useEffect } from 'react'
import { Toaster } from 'sonner'

import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  Outlet,
  Navigate,
} from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { VerComoClienteProvider, useVerComoCliente } from '@/context/VerComoClienteContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AdminLayout } from '@/components/AdminNav'
import ScrollToTop from '@/components/ScrollToTop'

import Index from './pages/Index'
import { DashboardPage } from './pages/Dashboard'
import { NewTransactionPage } from './pages/NewTransaction'
import { EditarTransacaoPage } from './pages/EditarTransacao'
import { ExtractPage } from './pages/Extract'
import { GruposPage } from './pages/Grupos'
import { PlansPage } from './pages/Plans'
import { CartoesPage } from './pages/Cartoes'
import { TutorialPage } from './pages/Tutorial'
import { BoasVindas } from './pages/BoasVindas'
import NotFound from './pages/NotFound'
import { AjudaPage } from './pages/Ajuda'
import { AtendimentosPage } from './pages/Atendimentos'
import { ImoveisLista } from './pages/imoveis/ImoveisLista'
import { ImovelDetalhe } from './pages/imoveis/ImovelDetalhe'
import { AdminDashboard } from './pages/admin/AdminDashboard'
import { AdminUsuarios } from './pages/admin/AdminUsuarios'

const CHAVE_TITULO = 'quitafy_titulo_pagina'

/** Define o título da aba a partir da rota atual. */
function TituloDasRotas() {
  const location = useLocation()

  useEffect(() => {
    const titulos: Record<string, string> = {
      '/': 'Início',
      '/dashboard': 'Resumo',
      '/nova-transacao': 'Nova transação',
      '/transacao': 'Editar transação',
      '/grupos': 'Grupos',
      '/planos': 'Planos',
      '/cartoes': 'Cartões',
      '/tutorial': 'Tutorial',
      '/boas-vindas': 'Boas-vindas',
      '/imoveis': 'Imóveis',
      '/ajuda': 'Ajuda',
      '/atendimentos': 'Atendimentos',
      '/admin': 'Painel admin',
    }
    const nome = titulos[location.pathname] || 'Quitafy'
    document.title = `Quitafy — ${nome}`
    window.localStorage.setItem(CHAVE_TITULO, nome)
  }, [location.pathname])

  return null
}

/**
 * Rota acessível SÓ por usuários admin (e sem o modo "ver como cliente").
 * Usa o ProtectedRoute como layout route (Outlet): a checagem de login fica
 * nele, aqui só checo o is_admin. Não-admin cai no 404 (não expõe que existe).
 */
function AdminRoute() {
  const { user } = useAuth()
  const { verComoCliente } = useVerComoCliente()

  if (!user || verComoCliente || !user.is_admin) {
    return <NotFound />
  }
  return <Outlet />
}

/**
 * Protege as rotas de CLIENTE contra o admin em modo admin: ele é levado de
 * volta ao painel. Admin em "ver como cliente" e cliente normal passam.
 */
function ClienteRoute() {
  const { user } = useAuth()
  const { verComoCliente } = useVerComoCliente()

  if (user?.is_admin && !verComoCliente) {
    return <Navigate to="/admin" replace />
  }
  return <Outlet />
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <VerComoClienteProvider>
          <TituloDasRotas />
          <ScrollToTop />
          <Toaster />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route element={<ProtectedRoute />}>
              {/* --- Painel admin (interface separada, sem nada de cliente) --- */}
              <Route element={<AdminRoute />}>
                <Route element={<AdminLayout />}>
                  <Route path="/admin" element={<AdminDashboard />} />
                  <Route path="/admin/usuarios" element={<AdminUsuarios />} />
                  <Route path="/admin/atendimentos" element={<AtendimentosPage />} />
                </Route>
              </Route>

              {/* --- App do cliente --- */}
              <Route element={<ClienteRoute />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/nova-transacao" element={<NewTransactionPage />} />
                <Route path="/transacao/:id" element={<EditarTransacaoPage />} />
                <Route path="/extrato" element={<ExtractPage />} />
                <Route path="/grupos" element={<GruposPage />} />
                <Route path="/planos" element={<PlansPage />} />
                <Route path="/cartoes" element={<CartoesPage />} />
                <Route path="/tutorial" element={<TutorialPage />} />
                <Route path="/ajuda" element={<AjudaPage />} />
                <Route path="/imoveis" element={<ImoveisLista />} />
                <Route path="/imoveis/:id" element={<ImovelDetalhe />} />
              </Route>
            </Route>
            <Route path="/boas-vindas" element={<BoasVindas />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </VerComoClienteProvider>
      </AuthProvider>
    </Router>
  )
}

export default App
