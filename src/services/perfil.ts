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

/** Dígitos de um telefone (ex.: "+554391141968" → "554391141968"). */
function digitos(telefone: string): string {
  return telefone.replace(/\D/g, '')
}

/** Registro em whatsapp_contas do usuário (null = sem vínculo ainda). */
async function contaWhatsapp(userId: string): Promise<{ id: string; numero: string } | null> {
  try {
    const rec = await pb.collection('whatsapp_contas').getFirstListItem(`user_id="${userId}"`)
    return { id: rec.id, numero: String(rec.numero || '') }
  } catch {
    return null
  }
}

/**
 * Mantém o vínculo número → usuário usado pelo webhook do WhatsApp
 * (coleção whatsapp_contas). Chamado sempre que o telefone do perfil muda:
 * cria o vínculo se não existia, troca o número se mudou e NÃO apaga o
 * vínculo se o telefone for limpo — desvincular pelo app poderia deixar
 * lançamentos do WhatsApp sem dono.
 */
async function sincronizarContaWhatsapp(userId: string, telefone: string): Promise<void> {
  const numero = digitos(telefone)
  if (!numero) return

  const atual = await contaWhatsapp(userId)

  // O índice único de whatsapp_contas.numero não deixa o mesmo número em duas
  // contas: detecto antes e devolvo uma mensagem que a pessoa entende.
  try {
    const dono = await pb.collection('whatsapp_contas').getFirstListItem(`numero="${numero}"`)
    if (dono.user_id !== userId) {
      throw new Error('Este número de WhatsApp já está vinculado a outra conta.')
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('outra conta')) throw err
  }

  if (!atual) {
    await pb.collection('whatsapp_contas').create({ numero, user_id: userId })
    return
  }
  if (atual.numero !== numero) {
    await pb.collection('whatsapp_contas').update(atual.id, { numero })
  }
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

  // Vínculo do número para o webhook do WhatsApp (coleção whatsapp_contas).
  await sincronizarContaWhatsapp(user.id, dados.telefone)

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
