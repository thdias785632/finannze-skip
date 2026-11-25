import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Smartphone,
  Wallet,
  PlusCircle,
  FileText,
  CreditCard,
  Users,
  UserRound,
  Repeat,
  CalendarClock,
  MessageCircle,
  Building2,
  Crown,
} from 'lucide-react'
import { secoesDoPlano, type SecaoTutorial } from '@/lib/tutorial'
import { NOME_PLANO } from '@/types/financial'
import { useAuth } from '@/context/AuthContext'
import { AppHeader } from '@/components/AppHeader'
import { BottomNav } from '@/components/BottomNav'

const ICONE_SECAO: Record<string, React.ReactNode> = {
  instalar: <Smartphone className="w-5 h-5 text-[#6639A6]" />,
  inicio: <Wallet className="w-5 h-5 text-[#6639A6]" />,
  'nova-transacao': <PlusCircle className="w-5 h-5 text-[#6639A6]" />,
  extrato: <FileText className="w-5 h-5 text-[#6639A6]" />,
  cartoes: <CreditCard className="w-5 h-5 text-[#6639A6]" />,
  grupos: <Users className="w-5 h-5 text-[#6639A6]" />,
  perfil: <UserRound className="w-5 h-5 text-[#6639A6]" />,
  recorrentes: <Repeat className="w-5 h-5 text-[#6639A6]" />,
  'meses-futuros': <CalendarClock className="w-5 h-5 text-[#6639A6]" />,
  whatsapp: <MessageCircle className="w-5 h-5 text-[#6639A6]" />,
  imoveis: <Building2 className="w-5 h-5 text-[#6639A6]" />,
}

/** Rótulo do plano mínimo exigido, exibido como badge na seção. */
const RotuloPlano: React.FC<{ secao: SecaoTutorial }> = ({ secao }) => {
  if (secao.planoMinimo === 'basico') return null
  return (
    <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-[#F1EAF9] px-2.5 py-1 text-[10px] font-bold text-[#6639A6]">
      <Crown className="w-3 h-3" />
      {NOME_PLANO[secao.planoMinimo]}
    </span>
  )
}

const Secao: React.FC<{ secao: SecaoTutorial; indice: number }> = ({ secao, indice }) => (
  <section
    aria-labelledby={`tutorial-secao-${secao.id}`}
    className="rounded-3xl border border-[#E2D6F0] bg-white p-5 shadow-sm"
  >
    <div className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#F1EAF9]"
      >
        {ICONE_SECAO[secao.id] ?? <Wallet className="w-5 h-5 text-[#6639A6]" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <h2
            id={`tutorial-secao-${secao.id}`}
            className="text-base font-black text-[#1F1438] leading-snug"
          >
            {indice}. {secao.titulo}
          </h2>
          <RotuloPlano secao={secao} />
        </div>
        <p className="mt-1 text-xs text-gray-500 leading-relaxed">{secao.descricao}</p>
      </div>
    </div>
    <ol className="mt-4 space-y-2">
      {secao.itens.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <span
            aria-hidden="true"
            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F1EAF9] text-[10px] font-bold text-[#6639A6]"
          >
            {i + 1}
          </span>
          <span className="text-xs leading-relaxed text-[#1F1438]">{item}</span>
        </li>
      ))}
    </ol>
  </section>
)

export const TutorialPage: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const secoes = secoesDoPlano(user?.plan)

  return (
    <div className="min-h-dvh bg-[#F5F3F7] pb-24">
      <AppHeader />

      <div className="max-w-md mx-auto px-4 pt-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Voltar para a tela anterior"
          className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-[#6639A6] hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        <h1 className="text-2xl font-black text-[#1F1438]">Tutorial</h1>
        <p className="mt-1 mb-5 text-sm text-gray-500">
          Aprenda a usar cada tela do Quitafy. Seu plano é o{' '}
          <strong className="text-[#4A247A]">{NOME_PLANO[user?.plan || 'basico']}</strong> — o guia
          mostra tudo o que ele inclui.
        </p>

        <div className="space-y-4">
          {secoes.map((secao, i) => (
            <Secao key={secao.id} secao={secao} indice={i + 1} />
          ))}
        </div>

        <div className="mt-6 flex items-start gap-2 rounded-2xl bg-[#F1EAF9] p-4">
          <Crown className="w-4 h-4 shrink-0 text-[#6639A6]" />
          <p className="text-xs leading-relaxed text-[#4A247A]">
            Quer mais recursos? Confira a tela <strong>Planos</strong> — cada plano inclui tudo do
            anterior e o tutorial acompanha a sua conta.
          </p>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
