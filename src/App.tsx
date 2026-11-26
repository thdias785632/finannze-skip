import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import ScrollToTop from '@/components/ScrollToTop'
import Index from '@/pages/Index'
import { DashboardPage } from '@/pages/Dashboard'
import { ExtractPage } from '@/pages/Extract'
import { CartoesPage } from '@/pages/Cartoes'
import { GruposPage } from '@/pages/Grupos'
import { PlansPage } from '@/pages/Plans'
import { ImoveisLista } from '@/pages/imoveis/ImoveisLista'
import { ImovelDetalhe } from '@/pages/imoveis/ImovelDetalhe'
import { NewTransactionPage } from '@/pages/NewTransaction'
import { EditarTransacaoPage } from '@/pages/EditarTransacao'
import { BoasVindas, consumirBoasVindasPendentes } from '@/pages/BoasVindas'
import { TutorialPage } from '@/pages/Tutorial'
import NotFound from '@/pages/NotFound'
import { Toaster } from '@/components/ui/toaster'

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ScrollToTop />
        <Toaster />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/resumo" element={<DashboardPage />} />
            <Route path="/extrato" element={<ExtractPage />} />
            <Route path="/cartoes" element={<CartoesPage />} />
            <Route path="/grupos" element={<GruposPage />} />
            <Route path="/imoveis" element={<ImoveisLista />} />
            <Route path="/imoveis/:id" element={<ImovelDetalhe />} />
            <Route path="/planos" element={<PlansPage />} />
            <Route path="/tutorial" element={<TutorialPage />} />
            <Route path="/nova-transacao" element={<NewTransactionPage />} />
            <Route path="/editar-transacao/:id" element={<EditarTransacaoPage />} />
            <Route
              path="/boas-vindas"
              element={
                consumirBoasVindasPendentes() ? <BoasVindas /> : <Navigate to="/resumo" replace />
              }
            />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
