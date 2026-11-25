import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, X, Crown, Users, MessageCircle, Building2, Sparkles } from 'lucide-react'
import { PLANOS } from '@/lib/planos'
import { useAuth } from '@/context/AuthContext'
import { AppHeader } from '@/components/AppHeader'
import { BottomNav } from '@/components/BottomNav'

const PLANO_ICONE: Record<string, React.ReactNode> = {
  basico: <Users className="w-4 h-4 text-[#6639A6]" />,
  bronze: <Sparkles className="w-4 h-4 text-[#6639A6]" />,
  prata: <MessageCircle className="w-4 h-4 text-[#6639A6]" />,
  ouro: <Building2 className="w-4 h-4 text-[#6639A6]" />,
}

export const PlansPage: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const planoAtual = user?.plan || 'basico'

  return (
    <div className="min-h-screen bg-[#F5F3F7] pb-24">
      <AppHeader />

      <div className="max-w-md mx-auto px-4 pt-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Voltar para a tela anterior"
          className="flex items-center gap-1.5 text-sm font-semibold text-[#6639A6] mb-4 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        <h1 className="text-2xl font-black text-[#1F1438]">Planos Quitafy</h1>
        <p className="text-sm text-gray-500 mt-1 mb-5">
          Escolha o plano ideal para o seu momento. Cada plano inclui tudo do anterior.
        </p>

        <div className="space-y-4">
          {PLANOS.map((plano) => {
            const atual = plano.id === planoAtual
            return (
              <div
                key={plano.id}
                className={`rounded-3xl border p-5 ${plano.color} relative overflow-hidden`}
              >
                {plano.popular && (
                  <span className="absolute top-0 right-0 rounded-bl-2xl bg-[#6639A6] px-3 py-1 text-[10px] font-bold text-white">
                    Mais popular
                  </span>
                )}
                {atual && (
                  <span className="absolute top-0 right-0 rounded-bl-2xl bg-emerald-600 px-3 py-1 text-[10px] font-bold text-white">
                    Seu plano
                  </span>
                )}

                <div className="flex items-center gap-2">
                  {PLANO_ICONE[plano.id]}
                  <h2 className="text-lg font-black text-[#1F1438]">{plano.name}</h2>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{plano.tagline}</p>

                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-2xl font-black text-[#4A247A]">{plano.price}</span>
                  {plano.period && (
                    <span className="text-xs font-semibold text-gray-500">{plano.period}</span>
                  )}
                </div>

                <ul className="mt-4 space-y-2">
                  {plano.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      {f.included ? (
                        <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <X className="w-4 h-4 text-gray-300 shrink-0 mt-0.5" />
                      )}
                      <span
                        className={`text-xs leading-relaxed ${
                          f.included ? 'text-[#1F1438]' : 'text-gray-400'
                        }`}
                      >
                        {f.included ? f.title : `${f.title} — ${f.reason}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>

        <div className="mt-6 flex items-start gap-2 rounded-2xl bg-[#F1EAF9] p-4">
          <Crown className="w-4 h-4 text-[#6639A6] shrink-0 mt-0.5" />
          <p className="text-xs text-[#4A247A] leading-relaxed">
            Para alterar o plano de um usuário para <strong>Bronze</strong>, <strong>Prata</strong>{' '}
            ou <strong>Ouro</strong>, fale com o administrador pelo menu Contato. A ativação é
            manual — sem cobrança automática no app.
          </p>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
