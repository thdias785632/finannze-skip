/**
 * Assinatura Quitafy: checkout Stripe, estado e cancelamento.
 * O backend (pocketbase/hooks/assinaturas.pb.js) faz toda chamada ao Stripe
 * pelo conector owner — aqui só falamos com as rotas /backend/v1/assinatura.
 */
import pb from '@/lib/pocketbase/client'
import type { UserPlan } from '@/types/financial'

const BASE = import.meta.env.VITE_POCKETBASE_URL.replace(/\/$/, '')

const rota = (caminho: string) => `${BASE}/backend/v1/assinatura${caminho}`

/** Estado da assinatura Stripe do usuário (vazio = nunca assinou). */
export interface EstadoAssinatura {
  ativa: boolean
  cancelando: boolean
  plano: UserPlan | ''
  status: string
  periodoFim: string | null
  subscriptionId: string
}

const VAZIO: EstadoAssinatura = {
  ativa: false,
  cancelando: false,
  plano: '',
  status: '',
  periodoFim: null,
  subscriptionId: '',
}

function normalizar(dados: unknown): EstadoAssinatura {
  if (typeof dados !== 'object' || dados === null) return VAZIO
  const d = dados as Record<string, unknown>
  return {
    ativa: d.ativa === true,
    cancelando: d.cancelando === true,
    plano: (typeof d.plano === 'string' ? d.plano : '') as UserPlan | '',
    status: typeof d.status === 'string' ? d.status : '',
    periodoFim: typeof d.periodoFim === 'string' ? d.periodoFim : null,
    subscriptionId: typeof d.subscriptionId === 'string' ? d.subscriptionId : '',
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

/** Pedido de cancelamento: o plano vale até o fim do período já pago. */
export async function cancelarAssinatura(): Promise<EstadoAssinatura> {
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
  return normalizar(corpo)
}
