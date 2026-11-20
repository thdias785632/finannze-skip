import pb from '@/lib/pocketbase/client'
import type { Transacao, TipoTransacao, Cartao } from '@/types/financial'

/**
 * Regra da fatura: um lançamento feito no dia do vencimento do cartão ou
 * depois cai na fatura do mês SEGUINTE. Receitas não têm cartão — usam o mês
 * da própria data.
 *
 * Ex.: cartão com vencimento dia 10 → compra de 10/05 aparece no extrato de
 * junho; compra de 09/05 aparece em maio.
 */
export const mesDaFatura = (
  transacao: Pick<Transacao, 'data' | 'tipo' | 'cartao_id'>,
  cartoes: Cartao[],
): string => {
  const d = new Date(transacao.data)
  let ano = d.getFullYear()
  let mes = d.getMonth() // 0-11

  if (transacao.tipo === 'despesa' && transacao.cartao_id) {
    const cartao = cartoes.find((c) => c.id === transacao.cartao_id)
    if (cartao && d.getDate() >= cartao.dia_vencimento) {
      mes += 1
      if (mes > 11) {
        mes = 0
        ano += 1
      }
    }
  }

  return `${ano}-${String(mes + 1).padStart(2, '0')}`
}

/** Rótulo legível do mês de fatura, ex.: "Fatura de junho/2026". */
export const rotuloFatura = (mesStr: string): string => {
  const [ano, mes] = mesStr.split('-').map(Number)
  const nome = new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long' })
  return `${nome}/${ano}`
}

export const transacoesService = {
  /**
   * Lista transações. Com `mes` (YYYY-MM), aplica a regra da fatura: cada
   * despesa com cartão é atribuída ao mês de vencimento da respectiva fatura,
   * e o resultado é ordenado por data. Sem `mes`, retorna tudo.
   */
  async list(filters?: {
    mes?: string // YYYY-MM
    recorrente?: boolean
  }): Promise<Transacao[]> {
    // Busca um intervalo maior e filtra pela regra da fatura no cliente:
    // a data de competência (t.data) pode cair no mês anterior ao da fatura.
    const all = await this.listRaw({ recorrente: filters?.recorrente })

    if (!filters?.mes) return all

    const cartoes = await this.cartoesDoUsuario()
    return all
      .filter((t) => mesDaFatura(t, cartoes) === filters.mes)
      .sort((a, b) => (a.data < b.data ? 1 : -1))
  },

  /** Lista por mês de competência (data real do lançamento), sem regra de fatura. */
  async listByCompetencia(filters?: { mes?: string; recorrente?: boolean }): Promise<Transacao[]> {
    return this.listRaw(filters)
  },

  async listRaw(filters?: { mes?: string; recorrente?: boolean }): Promise<Transacao[]> {
    let filterStr = ''
    const parts: string[] = []

    if (filters?.mes) {
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
      expand: 'cartao_id,categoria_id',
    })

    return records.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      descricao: r.descricao,
      valor: Number(r.valor),
      tipo: r.tipo as TipoTransacao,
      data: r.data,
      cartao_id: r.cartao_id || undefined,
      categoria_id: r.categoria_id,
      recorrente: Boolean(r.recorrente),
      recorrencia_periodo: r.recorrencia_periodo,
      pago: Boolean(r.pago),
      expand: {
        cartao_id: r.expand?.cartao_id
          ? {
              id: r.expand.cartao_id.id,
              user_id: r.expand.cartao_id.user_id,
              nome: r.expand.cartao_id.nome,
              dia_vencimento: Number(r.expand.cartao_id.dia_vencimento),
              cor: r.expand.cartao_id.cor,
              created: r.expand.cartao_id.created,
              updated: r.expand.cartao_id.updated,
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

  /** Cartões do usuário logado (usado para a regra da fatura). */
  async cartoesDoUsuario(): Promise<Cartao[]> {
    const records = await pb.collection('cartoes').getFullList({ sort: '-created' })
    return records.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      nome: r.nome,
      dia_vencimento: Number(r.dia_vencimento),
      cor: r.cor,
      created: r.created,
      updated: r.updated,
    }))
  },

  async create(data: {
    descricao: string
    valor: number
    tipo: TipoTransacao
    data: string
    cartao_id?: string
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
        cartao_id: data.cartao_id || null,
        categoria_id: data.categoria_id || null,
        recorrente: Boolean(data.recorrente),
        recorrencia_periodo: data.recorrencia_periodo || 'mensal',
        pago: data.pago !== undefined ? data.pago : true,
      },
      {
        expand: 'cartao_id,categoria_id',
      },
    )

    return {
      id: r.id,
      user_id: r.user_id,
      descricao: r.descricao,
      valor: Number(r.valor),
      tipo: r.tipo as TipoTransacao,
      data: r.data,
      cartao_id: r.cartao_id || undefined,
      categoria_id: r.categoria_id,
      recorrente: Boolean(r.recorrente),
      recorrencia_periodo: r.recorrencia_periodo,
      pago: Boolean(r.pago),
      created: r.created,
      updated: r.updated,
    }
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('transacoes').delete(id)
  },
}
