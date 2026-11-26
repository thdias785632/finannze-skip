import pb from '@/lib/pocketbase/client'
import type { Cartao } from '@/types/financial'

const mapCartao = (r: Record<string, unknown>): Cartao => {
  const rec = r as {
    id: string
    user_id: string
    nome: string
    dia_vencimento: number
    fechamento_ajustado?: string
    cor?: string
    created: string
    updated: string
  }
  return {
    id: rec.id,
    user_id: rec.user_id,
    nome: rec.nome,
    dia_vencimento: Number(rec.dia_vencimento),
    fechamento_ajustado: rec.fechamento_ajustado || undefined,
    cor: rec.cor,
    created: rec.created,
    updated: rec.updated,
  }
}

export const cartoesService = {
  async list(): Promise<Cartao[]> {
    const records = await pb.collection('cartoes').getFullList({
      sort: '-created',
    })
    return records.map(mapCartao)
  },

  async create(data: { nome: string; dia_vencimento: number; cor?: string }): Promise<Cartao> {
    const userId = pb.authStore.record?.id
    if (!userId) throw new Error('Usuário não autenticado')

    const r = await pb.collection('cartoes').create({
      user_id: userId,
      nome: data.nome,
      dia_vencimento: data.dia_vencimento,
      cor: data.cor || '#6639A6',
    })

    return mapCartao(r)
  },

  async update(
    id: string,
    data: Partial<{
      nome: string
      dia_vencimento: number
      cor?: string
      fechamento_ajustado: string | null
    }>,
  ): Promise<Cartao> {
    const r = await pb.collection('cartoes').update(id, data)
    return mapCartao(r)
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('cartoes').delete(id)
  },
}
