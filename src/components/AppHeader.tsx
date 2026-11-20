import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { LogOut, Sparkles } from 'lucide-react'

interface AppHeaderProps {
  title?: string
}

export const AppHeader: React.FC<AppHeaderProps> = ({ title = 'Finanzze' }) => {
  const { user, plan, logout } = useAuth()

  const planBadgeClasses = {
    free: 'bg-gray-100 text-gray-700 border-gray-200',
    vip: 'bg-purple-100 text-[#6639A6] border-purple-200 font-bold',
    premium:
      'bg-gradient-to-r from-amber-100 to-amber-200 text-amber-800 border-amber-300 font-black shadow-xs',
  }

  return (
    <header className="sticky top-0 z-30 bg-[#6639A6] text-white px-4 py-3 shadow-[0_4px_20px_rgba(102,57,166,0.25)]">
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/" className="flex items-center gap-1.5 focus:outline-none">
            <span className="text-xl font-black tracking-wider uppercase text-white drop-shadow-xs">
              FINANZZE
            </span>
          </Link>
          <Link
            to="/planos"
            className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border transition hover:opacity-90 flex items-center gap-1 ${
              planBadgeClasses[plan]
            }`}
          >
            {plan === 'premium' && (
              <Sparkles className="w-2.5 h-2.5 text-amber-600 fill-amber-500" />
            )}
            {plan}
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={logout}
            title={`Sair (${user?.email})`}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition active:scale-95"
            aria-label="Sair da conta"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
