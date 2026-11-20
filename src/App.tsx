/* Main App Component - Handles routing (using react-router-dom), query client and other providers - use this file to add all routes */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/context/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'

import Index from './pages/Index'
import NotFound from './pages/NotFound'
import Layout from './components/Layout'

// Páginas do Finanzze
import { ExtractPage } from './pages/Extract'
import { NewTransactionPage } from './pages/NewTransaction'
import { AccountsPage } from './pages/Accounts'
import { RecurringPage } from './pages/Recurring'
import { RealEstatePage } from './pages/RealEstate'
import { PlansPage } from './pages/Plans'

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Index />} />

            {/* Rotas Autenticadas */}
            <Route element={<ProtectedRoute />}>
              <Route path="/extrato" element={<ExtractPage />} />
              <Route path="/nova-transacao" element={<NewTransactionPage />} />
              <Route path="/contas" element={<AccountsPage />} />
              <Route path="/recorrentes" element={<RecurringPage />} />
              <Route path="/imoveis" element={<RealEstatePage />} />
              <Route path="/planos" element={<PlansPage />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
