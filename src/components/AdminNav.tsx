import React from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, LifeBuoy, Users } from 'lucide-react'
import { PerfilMenu } from '@/components/PerfilMenu'

interface Props {
  /** Passado quando o layout é usado fora do router (ex.: Index). */
  children?: React.ReactNode
}

const itens = [
  { to: '/admin', label: 'Dashboard', icone: LayoutDashboard, fim: true },
  { to: '/admin/usuarios', label: 'Usuários', icone: Users, fim: false },
  { to: '/admin/atendimentos', label: 'Atendimentos', icone: LifeBuoy, fim: false },
]

/**
 * Interface separada do painel admin: cabeçalho roxo com o PerfilMenu (mesmo
 * do app do cliente — o toggle "Ver como cliente" fica lá) e uma navegação
 * própria (Dashboard / Usuários / Atendimentos). Nada da interface de cliente
 * aparece aqui: o Outlet troca por Dashboard/Usuários/Atendimentos.
 */
export const AdminLayout: React.FC<Props> = ({ children }) => {
  return (
    <div className="min-h-dvh bg-[#F6F3FB] flex flex-col">
      {/* Cabeçalho do painel */}
      <header className="bg-[#7C3AED] text-white">
        <div className="mx-auto w-full max-w-6xl px-4 pt-4 pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <img
                src="/quitafy-logo.png"
                alt="Logo do Quitafy"
                className="h-8 w-8 rounded-lg"
                width={32}
                height={32}
              />
              <div className="leading-tight">
                <p className="text-sm font-bold tracking-wide">Quitafy</p>
                <p className="text-[11px] text-white/70 uppercase tracking-wider">
                  Painel do administrador
                </p>
              </div>
            </div>
            <PerfilMenu />
          </div>

          {/* Navegação do painel */}
          <nav aria-label="Menu do painel admin" className="mt-3 flex items-center gap-1">
            {itens.map(({ to, label, icone: Icone, fim }) => (
              <NavLink
                key={to}
                to={to}
                end={fim}
                className={({ isActive }: { isActive: boolean }) =>
                  `flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                    isActive
                      ? 'bg-white text-[#7C3AED]'
                      : 'text-white/85 hover:bg-white/15 hover:text-white'
                  }`
                }
              >
                <Icone className="h-4 w-4" strokeWidth={2} aria-hidden />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 pb-16">
        {children ?? <Outlet />}
      </main>
    </div>
  )
}
