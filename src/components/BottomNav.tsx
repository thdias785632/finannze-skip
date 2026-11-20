import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, ReceiptText, Repeat, CreditCard, Building2, Crown } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

export const BottomNav: React.FC = () => {
  const location = useLocation()
  const { plan, canAccessRecurring, canAccessImoveis } = useAuth()

  const navItems = [
    {
      to: '/',
      label: 'Início',
      icon: LayoutDashboard,
      active: location.pathname === '/',
    },
    {
      to: '/extrato',
      label: 'Extrato',
      icon: ReceiptText,
      active: location.pathname.startsWith('/extrato'),
    },
    {
      to: '/cartoes',
      label: 'Cartões',
      icon: CreditCard,
      active: location.pathname.startsWith('/cartoes'),
    },
    {
      to: '/recorrentes',
      label: 'Recorrentes',
      icon: Repeat,
      active: location.pathname.startsWith('/recorrentes'),
      badge: !canAccessRecurring ? 'VIP' : undefined,
    },
    ...(canAccessImoveis
      ? [
          {
            to: '/imoveis',
            label: 'Imóveis',
            icon: Building2,
            active: location.pathname.startsWith('/imoveis'),
          },
        ]
      : []),
    {
      to: '/planos',
      label: 'Planos',
      icon: Crown,
      active: location.pathname.startsWith('/planos'),
      badge: plan.toUpperCase(),
    },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E5DEEE] px-2 py-1.5 shadow-[0_-4px_20px_rgba(102,57,166,0.06)]">
      <div className="max-w-md mx-auto flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`relative flex flex-col items-center justify-center py-1 px-2.5 rounded-full transition-all duration-200 select-none ${
                item.active ? 'text-[#6639A6] font-semibold' : 'text-[#6B7280] hover:text-[#4A247A]'
              }`}
            >
              {/* Pílula roxa ativa clássica do app */}
              <div
                className={`relative flex items-center justify-center px-4 py-1 rounded-full transition-all ${
                  item.active ? 'bg-[#6639A6]/12 text-[#6639A6]' : 'bg-transparent'
                }`}
              >
                <Icon
                  className={`w-5 h-5 transition-transform ${item.active ? 'scale-110 stroke-[2.4]' : 'stroke-[1.8]'}`}
                />
                {item.badge && (
                  <span
                    className={`absolute -top-1 -right-2 text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase leading-tight ${
                      item.badge === 'PREMIUM'
                        ? 'bg-amber-500 text-white'
                        : item.badge === 'VIP'
                          ? 'bg-[#6639A6] text-white'
                          : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </div>
              <span
                className={`text-[11px] mt-0.5 tracking-tight ${item.active ? 'font-bold text-[#6639A6]' : 'font-medium'}`}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
