import pb from '@/lib/pocketbase/client'
import type { Categoria } from '@/types/financial'

export const categoriasService = {
  async list(): Promise<Categoria[]> {
    const records = await pb.collection('categorias').getFullList({
      sort: 'nome',
    })
    return records.map((r) => ({
      id: r.id,
      nome: r.nome,
      cor: r.cor,
      tipo: r.tipo,
      icone: r.icone,
      user_id: r.user_id,
      created: r.created,
      updated: r.updated,
    }))
  },

  async create(data: {
    nome: string
    cor: string
    tipo?: 'receita' | 'despesa' | 'ambos'
    icone?: string
  }): Promise<Categoria> {
    const userId = pb.authStore.record?.id
    const r = await pb.collection('categorias').create({
      user_id: userId || '',
      nome: data.nome,
      cor: data.cor,
      tipo: data.tipo || 'despesa',
      icone: data.icone || 'tag',
    })

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
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('categorias').delete(id)
  },
}
