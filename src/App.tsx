import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import ScrollToTop from '@/components/ScrollToTop'
import Index from '@/pages/Index'
import { DashboardPage } from '@/pages/Dashboard'
import { ExtractPage } from '@/pages/Extract'
import { CartoesPage } from '@/pages/Cartoes'
import { PlansPage } from '@/pages/Plans'
import { ImoveisLista } from '@/pages/imoveis/ImoveisLista'
import { ImovelDetalhe } from '@/pages/imoveis/ImovelDetalhe'
import { NewTransactionPage } from '@/pages/NewTransaction'
import { EditarTransacaoPage } from '@/pages/EditarTransacao'
import NotFound from '@/pages/NotFound'

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/resumo" element={<DashboardPage />} />
            <Route path="/extrato" element={<ExtractPage />} />
            <Route path="/cartoes" element={<CartoesPage />} />
            <Route path="/imoveis" element={<ImoveisLista />} />
            <Route path="/imoveis/:id" element={<ImovelDetalhe />} />
            <Route path="/planos" element={<PlansPage />} />
            <Route path="/nova-transacao" element={<NewTransactionPage />} />
            <Route path="/editar-transacao/:id" element={<EditarTransacaoPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
