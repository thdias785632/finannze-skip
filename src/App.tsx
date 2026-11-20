import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import Index from '@/pages/Index'
import { DashboardPage } from '@/pages/Dashboard'
import { ExtractPage } from '@/pages/Extract'
import { CartoesPage } from '@/pages/Cartoes'
import { PlansPage } from '@/pages/Plans'
import { RealEstatePage } from '@/pages/RealEstate'
import { NewTransactionPage } from '@/pages/NewTransaction'
import NotFound from '@/pages/NotFound'

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/resumo" element={<DashboardPage />} />
            <Route path="/extrato" element={<ExtractPage />} />
            <Route path="/cartoes" element={<CartoesPage />} />
            <Route path="/imoveis" element={<RealEstatePage />} />
            <Route path="/planos" element={<PlansPage />} />
            <Route path="/nova-transacao" element={<NewTransactionPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
