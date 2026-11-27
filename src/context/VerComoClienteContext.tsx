import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '@/context/AuthContext'

/**
 * Toggle "Ver como cliente" do admin: com o modo ativo, o admin navega no app
 * com a visão de um cliente normal (sem itens de admin no menu, sem acesso à
 * tela Atendimentos) até desativar o toggle ou sair. Estado só em sessão.
 */
interface VerComoClienteContexto {
  /** Modo ativo = admin navegando como cliente comum. */
  verComoCliente: boolean
  alternar: (ativo: boolean) => void
}

const VerComoClienteContext = createContext<VerComoClienteContexto | undefined>(undefined)

export const VerComoClienteProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth()
  const [verComoCliente, setVerComoCliente] = useState(false)

  // Trocou de conta (ou deslogou): o modo cliente sempre desliga.
  useEffect(() => {
    setVerComoCliente(false)
  }, [user?.id])

  const alternar = (ativo: boolean) => setVerComoCliente(ativo)

  return (
    <VerComoClienteContext.Provider value={{ verComoCliente, alternar }}>
      {children}
    </VerComoClienteContext.Provider>
  )
}

export function useVerComoCliente(): VerComoClienteContexto {
  const ctx = useContext(VerComoClienteContext)
  if (!ctx) throw new Error('useVerComoCliente deve ser usado dentro de VerComoClienteProvider')
  return ctx
}
