import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { PLANOS } from '@/lib/planos'
import { Check, Crown, Phone, Sparkles, PartyPopper } from 'lucide-react'

/**
 * Tela de boas-vindas exibida logo após a criação da conta:
 * cumprimenta o usuário pelo nome e apresenta os planos VIP e Premium
 * com preços e o que cada um libera.
 */
export const BoasVindas: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [saindo, setSaindo] = useState(false)

  // Foco no botão principal ao abrir, para navegação por teclado
  useEffect(() => {
    document.getElementById('boas-vindas-concluir')?.focus()
  }, [])

  const primeiroNome = (user?.name || '').trim().split(/\s+/)[0] || 'tudo certo'

  const concluir = () => {
    setSaindo(true)
    navigate('/resumo', { replace: true })
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#1A0E2E] via-[#2A1548] to-[#1A0E2E] text-white flex flex-col px-4 py-8 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-[#9D4EDD]/20 blur-[120px] pointer-events-none rounded-full" />

      <header className="flex flex-col items-center text-center max-w-md w-full mx-auto pt-4 z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs text-purple-200 font-medium mb-3">
          <PartyPopper className="w-3.5 h-3.5 text-amber-300" />
          Conta criada com sucesso
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white drop-shadow-md">
          Bem-vindo, {primeiroNome}!
        </h1>
        <p className="mt-2 text-sm text-white/70 max-w-xs">
          Sua jornada no Quitafy começou. Você já está no plano <strong>Free</strong> — e pode
          evoluir quando quiser:
        </p>
      </header>

      <main className="w-full max-w-[420px] mx-auto my-6 space-y-3.5 z-10">
        {PLANOS.filter((p) => p.id !== 'free').map((p) => (
          <section
            key={p.id}
            className={`rounded-3xl p-5 border-2 ${
              p.popular
                ? 'border-[#9D4EDD] bg-gradient-to-b from-[#6639A6]/30 to-white/5 shadow-lg'
                : 'border-amber-300/60 bg-gradient-to-b from-amber-400/10 to-white/5'
            }`}
            aria-label={`Plano ${p.name}`}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-2">
                <Crown className={`w-4 h-4 ${p.popular ? 'text-[#C9A0FF]' : 'text-amber-300'}`} />
                <h2 className="text-base font-black uppercase tracking-wide">{p.name}</h2>
              </div>
              {p.popular && (
                <span className="text-[9px] uppercase font-black bg-[#6639A6] text-white px-2 py-0.5 rounded-full tracking-wider">
                  Mais Popular
                </span>
              )}
            </div>
            <p className="mb-3">
              <span className="text-2xl font-black">{p.price}</span>
              <span className="text-xs text-white/60 font-semibold"> {p.period}</span>
            </p>
            <ul className="space-y-1.5">
              {p.features
                .filter((f) => f.included && !f.title.startsWith('Tudo'))
                .filter((f) => f.title !== 'Prioridade em novos recursos do Quitafy')
                .map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-white/85">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    {f.title}
                  </li>
                ))}
            </ul>
          </section>
        ))}

        <div className="rounded-2xl p-3.5 bg-white/5 border border-white/10 flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-purple-300 shrink-0 mt-0.5" />
          <p className="text-[11px] text-white/70 leading-relaxed">
            A ativação dos planos é feita pelo administrador — sem cobrança automática no app. Se
            você cadastrou seu telefone, ele será usado para vincular seu WhatsApp (Premium).
          </p>
        </div>

        {user?.telefone ? (
          <p className="flex items-center justify-center gap-1.5 text-[11px] text-white/60">
            <Phone className="w-3 h-3" />
            Telefone cadastrado: {user.telefone}
          </p>
        ) : null}
      </main>

      <footer className="w-full max-w-[420px] mx-auto mt-auto z-10">
        <button
          id="boas-vindas-concluir"
          type="button"
          onClick={concluir}
          disabled={saindo}
          className="w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#4A247A] via-[#6639A6] to-[#7A45BF] text-white font-semibold text-sm shadow-[0_8px_20px_rgba(102,57,166,0.35)] hover:opacity-95 active:scale-[0.99] transition disabled:opacity-60 cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          Começar a usar o Quitafy
        </button>
      </footer>
    </div>
  )
}
