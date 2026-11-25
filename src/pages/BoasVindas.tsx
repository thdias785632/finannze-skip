import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Check,
  X,
  Crown,
  PartyPopper,
  Users,
  MessageCircle,
  Building2,
  Sparkles,
  GraduationCap,
} from 'lucide-react'
import { PLANOS } from '@/lib/planos'
import { secoesBasicas } from '@/lib/tutorial'
import { useAuth } from '@/context/AuthContext'
import { AppHeader } from '@/components/AppHeader'
import { BottomNav } from '@/components/BottomNav'

export const CHAVE_BOAS_VINDAS = 'quitafy:boas-vindas-pendentes'

/** Marca que o próximo acesso a /boas-vindas é pós-cadastro (só o signup chama). */
export function marcarBoasVindasPendentes() {
  try {
    sessionStorage.setItem(CHAVE_BOAS_VINDAS, '1')
  } catch {
    /* storage indisponível */
  }
}

/** Consome a flag pós-cadastro: true apenas na primeira visita após o signup. */
export function consumirBoasVindasPendentes(): boolean {
  try {
    if (sessionStorage.getItem(CHAVE_BOAS_VINDAS) === '1') {
      sessionStorage.removeItem(CHAVE_BOAS_VINDAS)
      return true
    }
  } catch {
    /* storage indisponível */
  }
  return false
}

const PLANO_ICONE: Record<string, React.ReactNode> = {
  basico: <Users className="w-4 h-4 text-[#6639A6]" />,
  bronze: <Sparkles className="w-4 h-4 text-[#6639A6]" />,
  prata: <MessageCircle className="w-4 h-4 text-[#6639A6]" />,
  ouro: <Building2 className="w-4 h-4 text-[#6639A6]" />,
}

export const BoasVindas: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const planoAtual = user?.plan || 'basico'

  useEffect(() => {
    consumirBoasVindasPendentes()
  }, [])

  return (
    <div className="min-h-screen bg-[#F5F3F7] pb-24">
      <AppHeader />

      <div className="max-w-md mx-auto px-4 pt-4">
        <div className="rounded-3xl bg-gradient-to-br from-[#7C3AED] to-[#6639A6] p-6 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <PartyPopper className="w-6 h-6 text-amber-300" />
            <h1 className="text-2xl font-black">Boas-vindas ao Quitafy!</h1>
          </div>
          <p className="text-sm text-white/90 leading-relaxed">
            {user?.name ? `${user.name.split(' ')[0]}, s` : 'S'}ua conta foi criada no plano{' '}
            <strong className="text-amber-300">Básico</strong>. Você já pode cadastrar receitas,
            despesas, cartões e dividir lançamentos em grupos compartilhados.
          </p>
        </div>

        <h2 className="mt-6 mb-3 flex items-center gap-2 text-lg font-bold text-[#1F1235]">
          <Crown className="w-5 h-5 text-[#6639A6]" /> Conheça nossos planos
        </h2>

        <div className="space-y-4">
          {PLANOS.map((plano) => {
            const atual = plano.id === planoAtual
            return (
              <div
                key={plano.id}
                className={`rounded-3xl border p-5 ${plano.color} relative overflow-hidden`}
              >
                {atual && (
                  <span className="absolute top-0 right-0 rounded-bl-2xl bg-emerald-600 px-3 py-1 text-[10px] font-bold text-white">
                    Seu plano
                  </span>
                )}
                <div className="flex items-center gap-2">
                  {PLANO_ICONE[plano.id]}
                  <h3 className="text-lg font-black text-[#1F1438]">{plano.name}</h3>
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

        <p className="mt-6 text-center text-xs text-gray-500">
          Ativação dos planos Bronze, Prata e Ouro feita pelo administrador — sem cobrança
          automática no app.
        </p>

        <h2 className="mt-8 mb-3 flex items-center gap-2 text-lg font-bold text-[#1F1235]">
          <GraduationCap className="w-5 h-5 text-[#6639A6]" /> Guia rápido do Básico
        </h2>
        <p className="mb-4 text-xs text-gray-500 leading-relaxed">
          Comece por aqui: instale o app na tela inicial e aprenda a usar cada tela. Quando o seu
          plano mudar, o Tutorial (no menu da sua foto) mostra o guia completo.
        </p>

        <div className="space-y-4">
          {secoesBasicas().map((secao) => (
            <div
              key={secao.id}
              className="rounded-3xl border border-[#E2D6F0] bg-white p-5 shadow-sm"
            >
              <div className="flex items-start gap-2">
                <GraduationCap className="w-4 h-4 mt-1 text-[#6639A6] shrink-0" />
                <h3 className="text-sm font-black text-[#1F1438] leading-snug">{secao.titulo}</h3>
              </div>
              <p className="mt-1.5 text-xs text-gray-500 leading-relaxed">{secao.descricao}</p>
              <ul className="mt-3 space-y-2">
                {secao.itens.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="text-xs leading-relaxed text-[#1F1438]">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="mt-6 w-full rounded-2xl bg-[#6639A6] py-3 text-sm font-bold text-white hover:bg-[#522c8a] transition"
        >
          Começar a usar o Quitafy
        </button>
      </div>

      <BottomNav />
    </div>
  )
}
