import pb from '@/lib/pocketbase/client'
import type { Conta, TipoConta } from '@/types/financial'

export const contasService = {
  async list(): Promise<Conta[]> {
    const records = await pb.collection('contas').getFullList({
      sort: 'nome',
    })
    return records.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      nome: r.nome,
      tipo: r.tipo as TipoConta,
      saldo: Number(r.saldo),
      cor: r.cor,
      created: r.created,
      updated: r.updated,
    }))
  },

  async create(data: {
    nome: string
    tipo: TipoConta
    saldo: number
    cor?: string
  }): Promise<Conta> {
    const userId = pb.authStore.record?.id
    if (!userId) throw new Error('Usuário não autenticado')

    const r = await pb.collection('contas').create({
      user_id: userId,
      nome: data.nome,
      tipo: data.tipo,
      saldo: data.saldo,
      cor: data.cor || '#820AD1',
    })

    return {
      id: r.id,
      user_id: r.user_id,
      nome: r.nome,
      tipo: r.tipo as TipoConta,
      saldo: Number(r.saldo),
      cor: r.cor,
      created: r.created,
      updated: r.updated,
    }
  },

  async update(
    id: string,
    data: Partial<{ nome: string; tipo: TipoConta; saldo: number; cor?: string }>,
  ): Promise<Conta> {
    const r = await pb.collection('contas').update(id, data)
    return {
      id: r.id,
      user_id: r.user_id,
      nome: r.nome,
      tipo: r.tipo as TipoConta,
      saldo: Number(r.saldo),
      cor: r.cor,
      created: r.created,
      updated: r.updated,
    }
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('contas').delete(id)
  },
}
