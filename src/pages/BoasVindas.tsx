import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Check, Crown, ArrowRight, Mail } from 'lucide-react'
import { PLANOS } from '@/lib/planos'
import { useAuth } from '@/context/AuthContext'

/**
 * Tela de boas-vindas mostrada APENAS após a criação de conta nova (signup).
 *
 * Mostra as mesmas informações do e-mail de boas-vindas enviado pelo backend
 * (plano Free atual, VIP e Premium com preços) na identidade visual roxa do
 * app. O botão "Começar" leva ao Início (/resumo). Login de usuário existente
 * NUNCA passa por aqui — a AuthScreen só marca a flag de sessão no signup.
 */

export const CHAVE_BOAS_VINDAS = 'quitafy_boas_vindas_v1'

export function marcarBoasVindasPendentes() {
  try {
    sessionStorage.setItem(CHAVE_BOAS_VINDAS, '1')
  } catch (_) {
    /* sessionStorage indisponível — sem a tela, cadastro segue normal */
  }
}

export function consumirBoasVindasPendentes(): boolean {
  try {
    if (sessionStorage.getItem(CHAVE_BOAS_VINDAS) === '1') {
      sessionStorage.removeItem(CHAVE_BOAS_VINDAS)
      return true
    }
  } catch {
    /* intentionally ignored */
  }
  return false
}

export const BoasVindas: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuth()

  const comecar = () => {
    consumirBoasVindasPendentes()
    navigate('/resumo', { replace: true })
  }

  return (
    <div className="min-h-dvh bg-[#F6F3FB] text-[#1F1438] flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Luz radial roxa de fundo */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-[#9D4EDD]/15 blur-[120px] pointer-events-none rounded-full" />

      <main className="w-full max-w-[420px] z-10 my-auto">
        {/* Cabeçalho */}
        <header className="flex flex-col items-center text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#6639A6]/10 border border-[#6639A6]/20 text-xs text-[#4A247A] font-medium mb-3">
            <Sparkles className="w-3.5 h-3.5 text-[#9D4EDD]" />
            Conta criada com sucesso
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#1F1438]">
            🎉 Bem-vindo(a){user?.name ? `, ${user.name.split(' ')[0]}` : ''}!
          </h1>
          <p className="mt-2 text-sm text-[#6B7280] max-w-xs leading-relaxed">
            Você começou sua jornada pelo plano <strong className="text-[#4A247A]">Free</strong>.
            Enviamos um e-mail com essas mesmas informações para {user?.email || 'seu e-mail'}.
          </p>
        </header>

        {/* Planos */}
        <section aria-label="Planos do Quitafy" className="space-y-3">
          {/* Free — plano atual */}
          <div className="bg-white rounded-2xl p-4 border border-[#E2D6F0]">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-black text-[#1F1438]">Free — seu plano atual</p>
              <p className="text-sm font-black text-[#4A247A]">Grátis</p>
            </div>
            <ul className="mt-2 space-y-1">
              <li className="flex items-start gap-1.5 text-xs text-gray-600">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                Controle de receitas e despesas, cartões e extrato do mês atual e passados
              </li>
            </ul>
          </div>

          {/* VIP e Premium — a partir de PLANOS, sem duplicar preços/benefícios */}
          {PLANOS.filter((p) => p.id !== 'free').map((p) => (
            <div key={p.id} className="bg-white rounded-2xl p-4 border border-[#E2D6F0]">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-black text-[#1F1438] flex items-center gap-1.5">
                  {p.id === 'vip' && <Crown className="w-3.5 h-3.5 text-[#9D4EDD]" />}
                  {p.name}
                </p>
                <p className="text-sm font-black text-[#4A247A]">
                  {p.price}
                  <span className="text-[10px] font-semibold text-gray-500">{p.period}</span>
                </p>
              </div>
              <ul className="mt-2 space-y-1">
                {p.features
                  .filter((f) => f.included && !f.title.startsWith('Tudo'))
                  .filter((f) => f.title !== 'Prioridade em novos recursos do Quitafy')
                  .map((f, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      {f.title}
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </section>

        <p className="flex items-start justify-center gap-1.5 text-[11px] text-[#6B7280] mt-4 text-center leading-relaxed">
          <Mail className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          As informações e preços também ficam na seção de Planos, dentro do app.
        </p>

        {/* CTA */}
        <button
          type="button"
          onClick={comecar}
          className="w-full h-12 mt-5 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#4A247A] via-[#6639A6] to-[#7A45BF] text-white font-semibold text-sm shadow-[0_8px_20px_rgba(102,57,166,0.35)] hover:opacity-95 active:scale-[0.99] transition cursor-pointer"
        >
          Começar
          <ArrowRight className="w-4 h-4" />
        </button>
      </main>

      <footer className="text-center text-xs text-[#6B7280]/70 z-10 pt-6">
        Quitafy © {new Date().getFullYear()}
      </footer>
    </div>
  )
}
