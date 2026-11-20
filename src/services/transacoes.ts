import pb from '@/lib/pocketbase/client'
import type { Transacao, TipoTransacao } from '@/types/financial'

export const transacoesService = {
  async list(filters?: {
    mes?: string // YYYY-MM
    recorrente?: boolean
  }): Promise<Transacao[]> {
    let filterStr = ''
    const parts: string[] = []

    if (filters?.mes) {
      // Começo e fim do mês
      const [ano, mes] = filters.mes.split('-').map(Number)
      const startDate = new Date(Date.UTC(ano, mes - 1, 1)).toISOString().slice(0, 10)
      const endMonth = mes === 12 ? 1 : mes + 1
      const endYear = mes === 12 ? ano + 1 : ano
      const endDate = new Date(Date.UTC(endYear, endMonth - 1, 1)).toISOString().slice(0, 10)

      parts.push(`data >= '${startDate}' && data < '${endDate}'`)
    }

    if (filters?.recorrente !== undefined) {
      parts.push(`recorrente = ${filters.recorrente}`)
    }

    if (parts.length > 0) {
      filterStr = parts.join(' && ')
    }

    const records = await pb.collection('transacoes').getFullList({
      filter: filterStr || undefined,
      sort: '-data',
      expand: 'conta_id,categoria_id',
    })

    return records.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      descricao: r.descricao,
      valor: Number(r.valor),
      tipo: r.tipo as TipoTransacao,
      data: r.data,
      conta_id: r.conta_id,
      categoria_id: r.categoria_id,
      recorrente: Boolean(r.recorrente),
      recorrencia_periodo: r.recorrencia_periodo,
      pago: Boolean(r.pago),
      expand: {
        conta_id: r.expand?.conta_id
          ? {
              id: r.expand.conta_id.id,
              user_id: r.expand.conta_id.user_id,
              nome: r.expand.conta_id.nome,
              tipo: r.expand.conta_id.tipo,
              saldo: Number(r.expand.conta_id.saldo),
              cor: r.expand.conta_id.cor,
              created: r.expand.conta_id.created,
              updated: r.expand.conta_id.updated,
            }
          : undefined,
        categoria_id: r.expand?.categoria_id
          ? {
              id: r.expand.categoria_id.id,
              nome: r.expand.categoria_id.nome,
              cor: r.expand.categoria_id.cor,
              tipo: r.expand.categoria_id.tipo,
              icone: r.expand.categoria_id.icone,
              created: r.expand.categoria_id.created,
              updated: r.expand.categoria_id.updated,
            }
          : undefined,
      },
      created: r.created,
      updated: r.updated,
    }))
  },

  async create(data: {
    descricao: string
    valor: number
    tipo: TipoTransacao
    data: string
    conta_id: string
    categoria_id?: string
    recorrente?: boolean
    recorrencia_periodo?: 'mensal' | 'anual'
    pago?: boolean
  }): Promise<Transacao> {
    const userId = pb.authStore.record?.id
    if (!userId) throw new Error('Usuário não autenticado')

    const dateVal = data.data.includes('T') ? data.data : `${data.data} 12:00:00.000Z`

    const r = await pb.collection('transacoes').create(
      {
        user_id: userId,
        descricao: data.descricao,
        valor: data.valor,
        tipo: data.tipo,
        data: dateVal,
        conta_id: data.conta_id,
        categoria_id: data.categoria_id || null,
        recorrente: Boolean(data.recorrente),
        recorrencia_periodo: data.recorrencia_periodo || 'mensal',
        pago: data.pago !== undefined ? data.pago : true,
      },
      {
        expand: 'conta_id,categoria_id',
      },
    )

    // Atualiza saldo da conta correspondente se pago
    try {
      const conta = await pb.collection('contas').getOne(data.conta_id)
      const saldoAtual = Number(conta.saldo)
      const delta = data.tipo === 'receita' ? data.valor : -data.valor
      await pb.collection('contas').update(data.conta_id, {
        saldo: saldoAtual + delta,
      })
    } catch (err) {
      console.warn('Não foi possível atualizar o saldo da conta:', err)
    }

    return {
      id: r.id,
      user_id: r.user_id,
      descricao: r.descricao,
      valor: Number(r.valor),
      tipo: r.tipo as TipoTransacao,
      data: r.data,
      conta_id: r.conta_id,
      categoria_id: r.categoria_id,
      recorrente: Boolean(r.recorrente),
      recorrencia_periodo: r.recorrencia_periodo,
      pago: Boolean(r.pago),
      created: r.created,
      updated: r.updated,
    }
  },

  async delete(id: string): Promise<boolean> {
    // Reverte saldo se possível antes de deletar
    try {
      const tx = await pb.collection('transacoes').getOne(id)
      if (tx.pago && tx.conta_id) {
        const conta = await pb.collection('contas').getOne(tx.conta_id)
        const delta = tx.tipo === 'receita' ? -Number(tx.valor) : Number(tx.valor)
        await pb.collection('contas').update(tx.conta_id, {
          saldo: Number(conta.saldo) + delta,
        })
      }
    } catch {
      /* intentionally ignored */
    }

    return pb.collection('transacoes').delete(id)
  },
}
