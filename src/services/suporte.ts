import pb from '@/lib/pocketbase/client'

const BASE = import.meta.env.VITE_POCKETBASE_URL.replace(/\/$/, '')

function headers(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: pb.authStore.token,
  }
}

async function lerErro(resp: Response): Promise<string> {
  try {
    const corpo = await resp.json()
    return corpo.error || ''
  } catch {
    return ''
  }
}

// ---------- Ajuda (chat com o agente de suporte) ----------

export interface MensagemAjuda {
  id: string
  papel: 'cliente' | 'agente'
  texto: string
  created: string
}

/** Envia a dúvida do cliente ao agente de suporte e devolve a resposta. */
export async function enviarAjuda(
  mensagem: string,
): Promise<{ resposta: string; escalonado: boolean }> {
  const resp = await fetch(`${BASE}/backend/v1/ajuda`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ mensagem }),
  })
  if (!resp.ok) {
    throw new Error((await lerErro(resp)) || 'Não foi possível enviar sua dúvida.')
  }
  return await resp.json()
}

/** Histórico da conversa de ajuda do usuário logado. */
export async function historicoAjuda(): Promise<MensagemAjuda[]> {
  const resp = await fetch(`${BASE}/backend/v1/ajuda/historico`, { headers: headers() })
  if (!resp.ok) return []
  const corpo: { mensagens?: MensagemAjuda[] } = await resp.json()
  return corpo.mensagens || []
}

// ---------- Atendimentos (caixa de entrada do admin) ----------

export interface Atendimento {
  id: string
  status: string
  canal: string
  assunto: string
  motivo_escalonamento: string
  cliente: string
  cliente_id: string
  cliente_telefone: string
  ultima_mensagem: string
  total_mensagens: number
  created: string
  updated: string
}

export interface MensagemAtendimento {
  id: string
  autor_papel: 'cliente' | 'admin'
  autor_id: string
  texto: string
  created: string
}

export interface AtendimentoDetalhe extends Omit<
  Atendimento,
  'ultima_mensagem' | 'total_mensagens'
> {
  mensagens: MensagemAtendimento[]
}

/** Lista de atendimentos — rota de admin (403 para usuário comum). */
export async function listarAtendimentos(): Promise<Atendimento[]> {
  const resp = await fetch(`${BASE}/backend/v1/atendimentos`, { headers: headers() })
  if (resp.status === 403) throw new Error('Acesso restrito ao administrador')
  if (!resp.ok) throw new Error((await lerErro(resp)) || 'Erro ao carregar atendimentos')
  const corpo: { atendimentos?: Atendimento[] } = await resp.json()
  return corpo.atendimentos || []
}

/** Detalhe de um atendimento, com todas as mensagens. */
export async function detalheAtendimento(id: string): Promise<AtendimentoDetalhe> {
  const resp = await fetch(`${BASE}/backend/v1/atendimentos/${id}`, { headers: headers() })
  if (!resp.ok) throw new Error((await lerErro(resp)) || 'Erro ao carregar o atendimento')
  return await resp.json()
}

export interface ResultadoResposta {
  whatsapp_entregue: boolean
  aviso?: string
}

/** Admin responde um atendimento — a resposta vai ao WhatsApp do cliente. */
export async function responderAtendimento(
  id: string,
  mensagem: string,
): Promise<ResultadoResposta> {
  const resp = await fetch(`${BASE}/backend/v1/atendimentos/responder`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ atendimento_id: id, mensagem }),
  })
  if (!resp.ok) {
    throw new Error((await lerErro(resp)) || 'Erro ao enviar a resposta')
  }
  return await resp.json()
}
