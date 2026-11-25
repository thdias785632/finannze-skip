import pb from '@/lib/pocketbase/client'
import type { Categoria } from '@/types/financial'

/** Forma bruta do registro PocketBase (campos livres, sem tipagem por coleção). */
interface RegistroCategoria {
  id: string
  nome: string
  cor: string
  tipo?: 'receita' | 'despesa' | 'ambos'
  icone?: string
  user_id?: string
  created: string
  updated: string
}

function mapear(r: RegistroCategoria): Categoria {
  return {
    id: r.id,
    nome: r.nome,
    cor: r.cor,
    tipo: r.tipo,
    icone: r.icone,
    user_id: r.user_id,
    created: r.created,
    updated: r.updated,
  }
}

export const categoriasService = {
  /**
   * Lista as categorias utilizáveis pelo usuário logado: as default/seed
   * (user_id vazio, visíveis para todos) + as criadas pelo próprio usuário.
   * Categorias de OUTROS usuários nunca aparecem — a API rule da coleção já
   * filtra no servidor; o filtro extra no cliente é defesa em profundidade
   * (e cobre respostas em cache antes do novo deploy das regras).
   */
  async list(): Promise<Categoria[]> {
    const userId = pb.authStore.record?.id
    const records = (await pb.collection('categorias').getFullList({
      sort: 'nome',
      ...(userId ? { filter: pb.filter("user_id = '' || user_id = {:userId}", { userId }) } : {}),
    })) as unknown as RegistroCategoria[]
    return records.filter((r) => !r.user_id || r.user_id === userId).map(mapear)
  },

  async create(data: {
    nome: string
    cor: string
    tipo?: 'receita' | 'despesa' | 'ambos'
    icone?: string
  }): Promise<Categoria> {
    const userId = pb.authStore.record?.id
    if (!userId) {
      throw new Error('Usuário não autenticado')
    }
    // O dono da categoria é SEMPRE o usuário autenticado — nunca global
    // (user_id vazio viraria categoria default visível para todo mundo).
    const r = (await pb.collection('categorias').create({
      user_id: userId,
      nome: data.nome,
      cor: data.cor,
      tipo: data.tipo || 'despesa',
      icone: data.icone || 'tag',
    })) as unknown as RegistroCategoria

    return mapear(r)
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('categorias').delete(id)
  },
}
