import pb from '@/lib/pocketbase/client'
import type { Imovel, ImovelCalculoINCC, IndiceINCC } from '@/types/financial'

export const imoveisService = {
  async list(): Promise<Imovel[]> {
    const records = await pb.collection('imoveis').getFullList({
      sort: '-created',
    })
    return records.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      nome: r.nome,
      construtora: r.construtora,
      valor_original: Number(r.valor_original),
      data_contrato: r.data_contrato,
      mes_base_incc: r.mes_base_incc,
      defasagem_meses: r.defasagem_meses !== undefined ? Number(r.defasagem_meses) : 2,
      data_entrega: r.data_entrega,
      observacoes: r.observacoes,
      created: r.created,
      updated: r.updated,
    }))
  },

  async create(data: {
    nome: string
    construtora?: string
    valor_original: number
    data_contrato?: string
    mes_base_incc: string
    defasagem_meses?: number
    data_entrega?: string
    observacoes?: string
  }): Promise<Imovel> {
    const userId = pb.authStore.record?.id
    if (!userId) throw new Error('Usuário não autenticado')

    const r = await pb.collection('imoveis').create({
      user_id: userId,
      nome: data.nome,
      construtora: data.construtora || '',
      valor_original: data.valor_original,
      data_contrato: data.data_contrato || null,
      mes_base_incc: data.mes_base_incc,
      defasagem_meses: data.defasagem_meses ?? 2,
      data_entrega: data.data_entrega || null,
      observacoes: data.observacoes || '',
    })

    return {
      id: r.id,
      user_id: r.user_id,
      nome: r.nome,
      construtora: r.construtora,
      valor_original: Number(r.valor_original),
      data_contrato: r.data_contrato,
      mes_base_incc: r.mes_base_incc,
      defasagem_meses: Number(r.defasagem_meses),
      data_entrega: r.data_entrega,
      observacoes: r.observacoes,
      created: r.created,
      updated: r.updated,
    }
  },

  async update(id: string, data: Partial<Imovel>): Promise<Imovel> {
    const r = await pb.collection('imoveis').update(id, data)
    return {
      id: r.id,
      user_id: r.user_id,
      nome: r.nome,
      construtora: r.construtora,
      valor_original: Number(r.valor_original),
      data_contrato: r.data_contrato,
      mes_base_incc: r.mes_base_incc,
      defasagem_meses: Number(r.defasagem_meses),
      data_entrega: r.data_entrega,
      observacoes: r.observacoes,
      created: r.created,
      updated: r.updated,
    }
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('imoveis').delete(id)
  },

  async calcularINCC(
    valorOriginal: number,
    mesBase: string,
    defasagem: number = 2,
  ): Promise<ImovelCalculoINCC> {
    try {
      const res = await pb.send<ImovelCalculoINCC>(
        `/backend/v1/incc/calcular?valor=${valorOriginal}&mesBase=${mesBase}&defasagem=${defasagem}`,
        { method: 'GET' },
      )
      return res
    } catch {
      // Fallback em caso de erro na rede ou resposta rápida: calcula com índices do banco
      const indices = await pb.collection('indices_incc').getFullList({
        sort: 'mes',
      })
      let fator = 1.0
      const historico: Array<{ mes: string; variacao: number }> = []

      const hoje = new Date()
      const refDate = new Date(hoje.getFullYear(), hoje.getMonth() - defasagem, 1)
      const refMes = `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, '0')}`

      for (const idx of indices) {
        if (idx.mes >= mesBase && idx.mes <= refMes) {
          const varNum = Number(idx.variacao_mensal)
          fator *= 1 + varNum / 100
          historico.push({ mes: idx.mes, variacao: varNum })
        }
      }

      const valorCorrigido = valorOriginal * fator
      return {
        valorOriginal,
        valorCorrigido: Math.round(valorCorrigido * 100) / 100,
        correcaoAcumulada: Math.round((valorCorrigido - valorOriginal) * 100) / 100,
        percentualAcumulado: Math.round((fator - 1) * 10000) / 100,
        mesBase,
        mesReferencia: refMes,
        defasagemMeses: defasagem,
        mesesAplicadosCount: historico.length,
        historico,
      }
    }
  },

  async syncINCCWithBCB(): Promise<{ success: boolean; message: string }> {
    return pb.send<{ success: boolean; message: string }>('/backend/v1/incc/sync', {
      method: 'GET',
    })
  },

  async listIndices(): Promise<IndiceINCC[]> {
    const list = await pb.collection('indices_incc').getFullList({
      sort: '-mes',
    })
    return list.map((i) => ({
      id: i.id,
      mes: i.mes,
      data_referencia: i.data_referencia,
      variacao_mensal: Number(i.variacao_mensal),
      fonte: i.fonte,
    }))
  },
}
