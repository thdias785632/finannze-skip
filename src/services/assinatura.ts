/**
 * Assinatura Quitafy: checkout Stripe, estado e cancelamento.
 * O backend (pocketbase/hooks/assinaturas.pb.js) faz toda chamada ao Stripe
 * pelo conector owner — aqui só falamos com as rotas /backend/v1/assinatura.
 */
import pb from '@/lib/pocketbase/client'
import type { UserPlan } from '@/types/financial'

const BASE = import.meta.env.VITE_POCKETBASE_URL.replace(/\/$/, '')

const rota = (caminho: string) => `${BASE}/backend/v1/assinatura${caminho}`

/** Prazo do direito de arrependimento (CDC art. 49 — 7 dias). */
export interface Arrependimento {
  dentro: boolean
  diasRestantes: number
  fim: string | null
}

/** Estado da assinatura Stripe do usuário (vazio = nunca assinou). */
export interface EstadoAssinatura {
  ativa: boolean
  cancelando: boolean
  plano: UserPlan | ''
  status: string
  periodoFim: string | null
  subscriptionId: string
  /** Início da assinatura (ISO); base do prazo de arrependimento. */
  inicio: string
  /** Prazo de arrependimento calculado no backend (7 dias, CDC art. 49). */
  arrependimento: Arrependimento
}

const VAZIO: EstadoAssinatura = {
  ativa: false,
  cancelando: false,
  plano: '',
  status: '',
  periodoFim: null,
  subscriptionId: '',
  inicio: '',
  arrependimento: { dentro: false, diasRestantes: 0, fim: null },
}

function normalizar(dados: unknown): EstadoAssinatura {
  if (typeof dados !== 'object' || dados === null) return VAZIO
  const d = dados as Record<string, unknown>
  const ar = (
    typeof d.arrependimento === 'object' && d.arrependimento !== null ? d.arrependimento : {}
  ) as Record<string, unknown>
  return {
    ativa: d.ativa === true,
    cancelando: d.cancelando === true,
    plano: (typeof d.plano === 'string' ? d.plano : '') as UserPlan | '',
    status: typeof d.status === 'string' ? d.status : '',
    periodoFim: typeof d.periodoFim === 'string' ? d.periodoFim : null,
    subscriptionId: typeof d.subscriptionId === 'string' ? d.subscriptionId : '',
    inicio: typeof d.inicio === 'string' ? d.inicio : '',
    arrependimento: {
      dentro: ar.dentro === true,
      diasRestantes: typeof ar.diasRestantes === 'number' ? ar.diasRestantes : 0,
      fim: typeof ar.fim === 'string' ? ar.fim : null,
    },
  }
}

/** Consulta o estado da assinatura do usuário logado. */
export async function consultarAssinatura(): Promise<EstadoAssinatura> {
  // sem barra final: o PocketBase registra a rota como /assinatura (sem /) e
  // uma chamada com barra cai no static file server como 404 "File not found."
  const resp = await fetch(rota(''), {
    headers: { Authorization: pb.authStore.token },
  })
  if (!resp.ok) return normalizar(null)
  return normalizar(await resp.json())
}

/** Cria a Checkout Session e devolve a URL do Stripe para redirecionar. */
export async function iniciarCheckout(plano: UserPlan): Promise<string> {
  const resp = await fetch(rota('/checkout'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: pb.authStore.token,
    },
    body: JSON.stringify({ plano }),
  })
  let corpo: { url?: string; error?: string } = {}
  try {
    corpo = await resp.json()
  } catch {
    corpo = {}
  }
  if (!resp.ok || !corpo.url) {
    throw new Error(corpo.error || 'Não foi possível iniciar o checkout. Tente novamente.')
  }
  return corpo.url
}

/**
 * Confirma o retorno do Stripe (GET ?checkout=ok&session_id=...) — ativa o
 * plano no PocketBase. Idempotente: pode rodar mais de uma vez.
 */
export async function confirmarRetorno(sessionId: string): Promise<UserPlan> {
  const resp = await fetch(rota(`/retorno?session_id=${encodeURIComponent(sessionId)}`), {
    headers: { Authorization: pb.authStore.token },
  })
  let corpo: { ativado?: boolean; plano?: UserPlan; error?: string } = {}
  try {
    corpo = await resp.json()
  } catch {
    corpo = {}
  }
  if (!resp.ok || !corpo.ativado || !corpo.plano) {
    throw new Error(corpo.error || 'Não foi possível confirmar a assinatura.')
  }
  return corpo.plano
}

export interface ResultadoCancelamento {
  estado: EstadoAssinatura
  /** true = dentro dos 7 dias: cancelamento imediato + reembolso integral. */
  arrependimento: boolean
  /** Estado do reembolso no ramo CDC: solicitado/pending/succeeded/pendente. */
  reembolso: string
  /** true = reembolso não pôde ser solicitado — estorno manual no Stripe. */
  reembolsoPendente: boolean
  /** Aviso p/ o usuário (ex.: reembolso a estornar manualmente pelo dono). */
  aviso: string
}

/**
 * Pedido de cancelamento. Dentro de 7 dias da contratação (CDC art. 49) o
 * backend cancela na hora e pede reembolso integral; após, só cancela a
 * renovação (benefícios até o fim do período pago).
 */
export async function cancelarAssinatura(): Promise<ResultadoCancelamento> {
  const resp = await fetch(rota('/cancelar'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: pb.authStore.token,
    },
  })
  let corpo: Record<string, unknown> = {}
  try {
    corpo = await resp.json()
  } catch {
    corpo = {}
  }
  if (!resp.ok) {
    throw new Error(
      (typeof corpo.error === 'string' && corpo.error) ||
        'Não foi possível cancelar a assinatura. Tente novamente.',
    )
  }
  return {
    estado: normalizar(corpo),
    arrependimento: corpo.arrependimento === true,
    reembolso: typeof corpo.reembolso === 'string' ? corpo.reembolso : '',
    reembolsoPendente: corpo.reembolsoPendente === true,
    aviso: typeof corpo.aviso === 'string' ? corpo.aviso : '',
  }
}
