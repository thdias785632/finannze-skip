import pb from '@/lib/pocketbase/client'
import type { User } from '@/types/financial'

const BASE = import.meta.env.VITE_POCKETBASE_URL.replace(/\/$/, '')

/** Caminho absoluto do arquivo de avatar salvo no PocketBase (vazio = sem foto). */
export function urlAvatar(avatar: string | undefined, userId: string): string | undefined {
  if (!avatar || !userId) return undefined
  return pb.files.getURL({ id: userId, collectionName: 'users' } as never, avatar, {
    thumb: '128x128',
  })
}

/**
 * Lê da rota pública GET /backend/v1/config/contato o link de WhatsApp que o
 * dono do app configura no secret WHATSAPP_CONTATO_URL (secrets não chegam ao
 * front). Sem secret configurado, resolve `null` e a opção Contato some.
 */
export async function buscarUrlContato(): Promise<string | null> {
  try {
    const resp = await fetch(`${BASE}/backend/v1/config/contato`)
    if (!resp.ok) return null
    const corpo: { contato?: string | null } = await resp.json()
    return corpo.contato || null
  } catch {
    return null
  }
}

/** Dados de perfil editáveis, já achatados para o formulário. */
export interface PerfilForm {
  nome: string
  telefone: string
  avatar: File | null
  removerAvatar: boolean
}

/** Atualiza o registro do usuário no PocketBase e devolve o User atualizado. */
export async function salvarPerfil(user: User, dados: PerfilForm): Promise<User> {
  const corpo = new FormData()
  corpo.append('name', dados.nome)
  corpo.append('telefone', dados.telefone)
  if (dados.avatar) corpo.append('avatar', dados.avatar)
  if (dados.removerAvatar) corpo.append('avatar', '')

  const rec = await pb.collection('users').update(user.id, corpo)

  // Reautentica para o authStore guardar o registro novo (avatar/nome/telefone)
  await pb.collection('users').authRefresh()

  return {
    id: rec.id,
    email: rec.email,
    name: (rec.name as string) || user.name,
    plan: user.plan,
    telefone: (rec.telefone as string) || undefined,
    avatar: (rec.avatar as string) || undefined,
    created: rec.created,
    updated: rec.updated,
  }
}

/**
 * Exclui a conta do usuário logado (rota backend /backend/v1/perfil/excluir).
 *
 * Coleções com user_id apontando para a conta — transações, cartões, categorias,
 * imóveis, fluxos, parcelas, divisões, grupos, membros, contas/mensagens/pendências
 * WhatsApp — são apagadas primeiro pelo servidor, para não deixar órfãos nem
 * quebrar grupos compartilhados com outras pessoas. O deslogar fica no chamador.
 */
export async function excluirConta(user: User): Promise<void> {
  const resp = await fetch(`${BASE}/backend/v1/perfil/excluir`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: pb.authStore.token,
    },
  })

  let corpo: { error?: string } = {}
  try {
    corpo = await resp.json()
  } catch {
    corpo = {}
  }

  if (!resp.ok) {
    throw new Error(corpo.error || 'Não foi possível excluir a conta. Tente novamente.')
  }
}
