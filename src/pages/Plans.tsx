import React from 'react'
import { AppHeader } from '@/components/AppHeader'
import { BottomNav } from '@/components/BottomNav'
import { useAuth } from '@/context/AuthContext'
import type { UserPlan } from '@/types/financial'
import { PLANOS } from '@/lib/planos'
import { Check, Crown, Shield, Info } from 'lucide-react'

export const PlansPage: React.FC = () => {
  const { plan } = useAuth()

  return (
    <div className="min-h-screen bg-[#F6F3FB] text-[#1F1438] pb-24">
      <AppHeader />

      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 text-[#6639A6] text-xs font-bold">
            <Crown className="w-3.5 h-3.5" />
            Seu plano atual: <span className="uppercase text-[#4A247A] font-black">{plan}</span>
          </div>
          <h1 className="text-xl font-black text-[#1F1438]">Comparativo de Planos</h1>
          <p className="text-xs text-gray-500 max-w-xs mx-auto">
            Veja o que cada perfil libera no Quitafy e escolha o plano ideal para suas metas
          </p>
        </div>

        {/* Informação sobre ativação manual pelo dono */}
        <div className="bg-white rounded-3xl p-4 border border-[#EBE4F5] shadow-xs flex items-start gap-3">
          <div className="w-8 h-8 rounded-2xl bg-purple-100 text-[#6639A6] flex items-center justify-center shrink-0 mt-0.5">
            <Info className="w-4 h-4" />
          </div>
          <div className="text-xs">
            <p className="font-bold text-[#1F1438]">Como funciona a ativação?</p>
            <p className="text-gray-600 mt-0.5 leading-relaxed text-[11px]">
              A ativação dos planos <strong>VIP</strong> e <strong>Premium</strong> é realizada
              diretamente pelo administrador do sistema. Para solicitar sua ativação, entre em
              contato com o suporte ou gestor do app.
            </p>
          </div>
        </div>

        {/* Cards dos Planos */}
        <div className="space-y-3.5">
          {PLANOS.map((p) => {
            const isCurrent = plan === p.id
            return (
              <div
                key={p.id}
                className={`rounded-3xl p-5 border-2 transition relative overflow-hidden ${p.color} ${
                  isCurrent ? 'ring-2 ring-[#6639A6]/30' : ''
                }`}
              >
                {p.popular && (
                  <div className="absolute top-0 right-0 bg-[#6639A6] text-white text-[9px] uppercase font-black px-3 py-1 rounded-bl-xl tracking-wider">
                    Mais Popular
                  </div>
                )}

                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h2 className="text-base font-black text-[#1F1438] flex items-center gap-1.5">
                      {p.name}
                      {isCurrent && (
                        <span className="text-[10px] bg-[#6639A6] text-white px-2 py-0.5 rounded-full font-bold">
                          Plano Atual
                        </span>
                      )}
                    </h2>
                    <p className="text-xs text-gray-500">{p.tagline}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-lg font-black text-[#1F1438]">{p.price}</span>
                    {p.period && (
                      <span className="block text-[10px] text-gray-500 font-semibold">
                        {p.period}
                      </span>
                    )}
                    {p.popular && (
                      <span className="block text-[10px] font-bold text-[#6639A6]">Assine VIP</span>
                    )}
                  </div>
                </div>

                {/* Lista de Recursos */}
                <div className="space-y-2 mt-4 pt-3 border-t border-gray-100">
                  {p.features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs">
                      {feat.included ? (
                        <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <span className="w-4 h-4 rounded-full bg-gray-200 text-gray-400 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold">
                          ✕
                        </span>
                      )}
                      <div>
                        <span
                          className={`font-medium ${
                            feat.included ? 'text-gray-800' : 'text-gray-400 line-through'
                          }`}
                        >
                          {feat.title}
                        </span>
                        {!feat.included && feat.reason && (
                          <span className="block text-[10px] text-purple-700 font-semibold">
                            {feat.reason}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Guia para o Dono do App (Instruções do Backend) */}
        <div className="bg-gradient-to-br from-[#1A0E2E] to-[#2A1548] text-white rounded-3xl p-5 shadow-md space-y-2">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-300" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Painel do Administrador (Como ativar usuários)
            </h3>
          </div>
          <p className="text-[11px] text-white/80 leading-relaxed">
            Para alterar o plano de um usuário para <strong>VIP</strong> ou <strong>Premium</strong>
            :
          </p>
          <ol className="text-[11px] text-white/70 space-y-1 list-decimal list-inside pl-1">
            <li>
              Acesse a aba <strong>Collections</strong> no painel PocketBase do projeto.
            </li>
            <li>
              Abra a coleção <strong>users</strong>.
            </li>
            <li>
              Edite o registro do usuário e mude o campo <strong>plan</strong> para <code>vip</code>{' '}
              ou <code>premium</code>.
            </li>
            <li>Pronto! O usuário ganha acesso instantâneo aos recursos na próxima navegação.</li>
          </ol>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
