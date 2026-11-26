import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  X,
  Crown,
  Users,
  MessageCircle,
  Building2,
  Sparkles,
  CreditCard,
  Loader2,
  PartyPopper,
} from 'lucide-react'
import { PLANOS } from '@/lib/planos'
import type { UserPlan } from '@/types/financial'
import { useAuth } from '@/context/AuthContext'
import { AppHeader } from '@/components/AppHeader'
import { BottomNav } from '@/components/BottomNav'
import { useToast } from '@/hooks/use-toast'
import {
  consultarAssinatura,
  iniciarCheckout,
  confirmarRetorno,
  cancelarAssinatura,
  type EstadoAssinatura,
} from '@/services/assinatura'

const PLANO_ICONE: Record<string, React.ReactNode> = {
  basico: <Users className="w-4 h-4 text-[#6639A6]" />,
  bronze: <Sparkles className="w-4 h-4 text-[#6639A6]" />,
  prata: <MessageCircle className="w-4 h-4 text-[#6639A6]" />,
  ouro: <Building2 className="w-4 h-4 text-[#6639A6]" />,
}

const ORDEM: UserPlan[] = ['basico', 'bronze', 'prata', 'ouro']

const formatoData = (iso: string | null): string => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export const PlansPage: React.FC = () => {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user, refresh } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const planoAtual = user?.plan || 'basico'

  const [assinatura, setAssinatura] = useState<EstadoAssinatura | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [planoEmAcao, setPlanoEmAcao] = useState<UserPlan | null>(null)

  const carregar = useCallback(async () => {
    try {
      setAssinatura(await consultarAssinatura())
    } catch {
      setAssinatura(null)
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  // Volta do Stripe: ?checkout=ok&session_id=... → ativa o plano.
  const checkoutOk = searchParams.get('checkout') === 'ok'
  const sessionId = searchParams.get('session_id')
  useEffect(() => {
    if (!checkoutOk || !sessionId) return
    let ativo = true
    setPlanoEmAcao('__checkout__' as UserPlan)
    confirmarRetorno(sessionId)
      .then(async (plano) => {
        if (!ativo) return
        await refresh()
        setPlanoEmAcao(null)
        setSearchParams({}, { replace: true })
        toast({
          title: 'Assinatura ativada!',
          description: `Bem-vindo ao plano ${plano.charAt(0).toUpperCase()}${plano.slice(1)}.`,
        })
      })
      .catch((err: Error) => {
        if (!ativo) return
        setPlanoEmAcao(null)
        toast({
          title: 'Assinatura não confirmada',
          description:
            err.message ||
            'Se o pagamento foi concluído, aguarde alguns minutos — o plano é ativado automaticamente.',
          variant: 'destructive',
        })
      })
    return () => {
      ativo = false
    }
  }, [checkoutOk, sessionId, refresh, setSearchParams, toast])

  const assinar = async (plano: UserPlan) => {
    setPlanoEmAcao(plano)
    try {
      const url = await iniciarCheckout(plano)
      window.location.assign(url)
    } catch (err) {
      setPlanoEmAcao(null)
      toast({
        title: 'Checkout indisponível',
        description:
          err instanceof Error
            ? err.message
            : 'Não foi possível abrir o checkout. Tente novamente.',
        variant: 'destructive',
      })
    }
  }

  const cancelar = async () => {
    const dentro = assinatura?.arrependimento?.dentro === true
    const dias = assinatura?.arrependimento?.diasRestantes ?? 0
    const msg = dentro
      ? `Você está dentro do prazo de arrependimento (${dias} ${dias === 1 ? 'dia' : 'dias'} restantes). A assinatura será cancelada IMEDIATAMENTE, o valor pago será reembolsado integralmente e o plano volta para o Básico agora. Confirmar?`
      : 'Cancelar a assinatura? O plano continua ativo até o fim do período já pago; depois, a conta volta para o Básico.'
    if (!confirm(msg)) {
      return
    }
    setPlanoEmAcao(planoAtual)
    try {
      const resultado = await cancelarAssinatura()
      setAssinatura(resultado.estado)
      if (resultado.arrependimento) {
        toast({
          title: 'Assinatura cancelada e reembolso solicitado',
          description:
            resultado.reembolsoPendente || resultado.aviso
              ? resultado.aviso ||
                'Seu plano já voltou para o Básico. O reembolso integral será processado em até 5–10 dias úteis.'
              : 'Seu plano voltou para o Básico. O reembolso integral será processado em até 5–10 dias úteis.',
        })
        await refresh()
      } else {
        toast({
          title: 'Cancelamento agendado',
          description: `O plano vale até ${formatoData(resultado.estado.periodoFim) || 'o fim do período pago'}; depois, volta ao Básico.`,
        })
      }
    } catch (err) {
      toast({
        title: 'Não foi possível cancelar',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setPlanoEmAcao(null)
    }
  }

  const planoAssinado =
    assinatura?.ativa && assinatura.plano ? (assinatura.plano as UserPlan) : null
  const acimaDoAtual = (id: UserPlan) => ORDEM.indexOf(id) > ORDEM.indexOf(planoAtual)
  const emConfirmacao = checkoutOk && !!sessionId
  const podeAssinar = (id: UserPlan) =>
    id !== 'basico' && acimaDoAtual(id) && planoAssinado !== id && !emConfirmacao && !planoEmAcao

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

        {checkoutOk && !sessionId && (
          <div className="mb-4 flex items-start gap-2 rounded-2xl bg-amber-50 border border-amber-200 p-4">
            <Loader2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 animate-spin" />
            <p className="text-xs text-amber-800 leading-relaxed">
              Pagamento em confirmação — o plano é ativado automaticamente em instantes.
            </p>
          </div>
        )}

        {assinatura?.cancelando && assinatura.ativa && (
          <div className="mb-4 rounded-2xl bg-amber-50 border border-amber-200 p-4">
            <p className="text-xs text-amber-800 leading-relaxed">
              <strong>Cancelamento agendado.</strong> O plano {planoAssinado || planoAtual} vale até{' '}
              {formatoData(assinatura.periodoFim) || 'o fim do período pago'}; depois, a conta volta
              para o Básico.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {PLANOS.map((plano) => {
            const atual = plano.id === planoAtual
            const assinado = planoAssinado === plano.id
            const emAcao = planoEmAcao === plano.id || emConfirmacao
            return (
              <div
                key={plano.id}
                className={`rounded-3xl border p-5 ${plano.color} relative overflow-hidden`}
              >
                {plano.popular && !assinado && (
                  <span className="absolute top-0 right-0 rounded-bl-2xl bg-[#6639A6] px-3 py-1 text-[10px] font-bold text-white">
                    Mais popular
                  </span>
                )}
                {atual && (
                  <span className="absolute top-0 right-0 rounded-bl-2xl bg-emerald-600 px-3 py-1 text-[10px] font-bold text-white">
                    Seu plano
                  </span>
                )}
                {assinado && !atual && (
                  <span className="absolute top-0 right-0 rounded-bl-2xl bg-sky-600 px-3 py-1 text-[10px] font-bold text-white">
                    Assinado
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

                {atual && plano.id !== 'basico' && assinado && (
                  <div className="mt-4 flex items-start gap-2 rounded-xl bg-white/70 p-3">
                    <PartyPopper className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="text-xs leading-relaxed text-[#1F1438]">
                      <p className="font-semibold">
                        Assinatura ativa
                        {assinatura?.cancelando ? ' — cancelamento agendado' : ''}
                      </p>
                      {assinatura?.periodoFim && (
                        <p className="text-gray-500">
                          Próxima renovação: {formatoData(assinatura.periodoFim)}
                        </p>
                      )}
                      {!assinatura?.cancelando && assinatura?.arrependimento?.dentro && (
                        <p className="mt-1 text-[11px] text-gray-500 leading-relaxed">
                          Cancelando agora, o valor pago é{' '}
                          <strong>reembolsado integralmente</strong> e o plano volta para o Básico
                          imediatamente.
                        </p>
                      )}
                      {!assinatura?.cancelando && !assinatura?.arrependimento?.dentro && (
                        <p className="mt-1 text-[11px] text-gray-500 leading-relaxed">
                          O cancelamento interrompe a renovação: o plano mantém os benefícios até o
                          fim do período pago, depois volta para o Básico.
                        </p>
                      )}
                      {!assinatura?.cancelando &&
                        (assinatura?.arrependimento?.dentro ? (
                          <div className="mt-1">
                            <p className="text-[11px] font-semibold text-amber-700">
                              Direito de arrependimento: {assinatura.arrependimento.diasRestantes}{' '}
                              {assinatura.arrependimento.diasRestantes === 1 ? 'dia' : 'dias'}
                              {assinatura.arrependimento.fim
                                ? ` (até ${formatoData(assinatura.arrependimento.fim)})`
                                : ''}
                            </p>
                            <button
                              type="button"
                              onClick={cancelar}
                              disabled={emAcao}
                              className="mt-1 text-[11px] font-semibold text-red-600 hover:underline disabled:opacity-50"
                            >
                              {emAcao
                                ? 'Cancelando…'
                                : 'Cancelar e reembolsar (direito de arrependimento — 7 dias)'}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={cancelar}
                            disabled={emAcao}
                            className="mt-1 text-[11px] font-semibold text-red-600 hover:underline disabled:opacity-50"
                          >
                            {emAcao ? 'Cancelando…' : 'Cancelar assinatura (renovação)'}
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                {atual && plano.id !== 'basico' && !assinado && (
                  <div className="mt-4 rounded-xl bg-white/70 p-3">
                    <p className="text-xs font-semibold text-[#1F1438]">Plano ativo</p>
                    <p className="text-[11px] text-gray-500 leading-relaxed mt-0.5">
                      Ativado manualmente pelo administrador. Para assinar com cobrança automática,
                      entre em contato pelo menu Contato.
                    </p>
                  </div>
                )}

                {podeAssinar(plano.id) && (
                  <button
                    type="button"
                    onClick={() => assinar(plano.id)}
                    disabled={!!planoEmAcao}
                    className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-[#6639A6] py-2.5 text-sm font-bold text-white hover:bg-[#55298a] disabled:opacity-60"
                  >
                    {emAcao ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Abrindo checkout…
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4" /> Assinar {plano.name}
                      </>
                    )}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-6 flex items-start gap-2 rounded-2xl bg-[#F1EAF9] p-4">
          <Crown className="w-4 h-4 text-[#6639A6] shrink-0 mt-0.5" />
          <p className="text-xs text-[#4A247A] leading-relaxed">
            Assine com cartão de crédito pelo checkout seguro do Stripe, em cobrança mensal. Para
            alterar um plano à mão, fale com o administrador pelo menu Contato.
          </p>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
