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

const mapTransacao = (r: Record<string, any>): Transacao => ({
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
  serie_id: r.serie_id || undefined,
  parcela_numero: r.parcela_numero ? Number(r.parcela_numero) : undefined,
  parcela_total: r.parcela_total ? Number(r.parcela_total) : undefined,
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
})

export const transacoesService = {
  /** Busca uma transação por id (com cartão e categoria expandidos). */
  async get(id: string): Promise<Transacao> {
    const r = await pb.collection('transacoes').getOne(id, {
      expand: 'cartao_id,categoria_id',
    })
    return mapTransacao(r)
  },

  /**
   * Atualiza uma transação EXISTENTE (não cria nova). Usado pela edição de
   * despesa de cartão: ao alterar data/cartão/valor, a regra da fatura
   * (mesDaFatura) recalcula para qual fatura o lançamento cai.
   */
  async update(
    id: string,
    data: {
      descricao?: string
      valor?: number
      tipo?: TipoTransacao
      data?: string
      cartao_id?: string | null
      categoria_id?: string | null
      recorrente?: boolean
      recorrencia_periodo?: 'mensal' | 'anual'
      pago?: boolean
    },
  ): Promise<Transacao> {
    const r = await pb.collection('transacoes').update(
      id,
      {
        ...(data.descricao !== undefined && { descricao: data.descricao }),
        ...(data.valor !== undefined && { valor: data.valor }),
        ...(data.tipo !== undefined && { tipo: data.tipo }),
        ...(data.data !== undefined && {
          data: data.data.includes('T') ? data.data : `${data.data} 12:00:00.000Z`,
        }),
        ...(data.cartao_id !== undefined && { cartao_id: data.cartao_id || null }),
        ...(data.categoria_id !== undefined && { categoria_id: data.categoria_id || null }),
        ...(data.recorrente !== undefined && { recorrente: Boolean(data.recorrente) }),
        ...(data.recorrencia_periodo !== undefined && {
          recorrencia_periodo: data.recorrencia_periodo,
        }),
        ...(data.pago !== undefined && { pago: data.pago }),
      },
      {
        expand: 'cartao_id,categoria_id',
      },
    )
    return mapTransacao(r)
  },

  /** Parcelas da MESMA série (mesmo serie_id) do usuário, ordenadas por data. */
  async listBySerie(serieId: string): Promise<Transacao[]> {
    const records = await pb.collection('transacoes').getFullList({
      filter: `serie_id = '${serieId}'`,
      sort: 'data',
      expand: 'cartao_id,categoria_id',
    })
    return records.map(mapTransacao)
  },

  /**
   * Edição de série: aplica a edição a TODAS as parcelas da série (mesmo
   * serie_id), SEM filtrar por pagas — a edição vale para a série inteira.
   *
   * O novo valor vale por igual; a data de cada parcela acompanha o mesmo
   * deslocamento de faturas (regra mesDaFatura) que ela tinha em relação à
   * parcela editada — cada parcela mantém o SEU mês de fatura, só movendo
   * junto. O nome novo vale para todas (mantido o sufixo "(k/n)" de cada
   * uma), assim como categoria, cartão e recorrente. Pagas ou não pagas:
   * todas recebem a edição, sem exceção.
   */
  async updateSerie(
    serieId: string,
    alvo: Transacao,
    cartoes: Cartao[],
    data: {
      descricao?: string
      valor?: number
      data?: string // YYYY-MM-DD — só quando o campo data foi alterado
      cartao_id?: string | null
      categoria_id?: string | null
      recorrente?: boolean
    },
  ): Promise<number> {
    // TODAS as parcelas da série, sem exceção — inclusive as já pagas e a
    // própria parcela editada (aplicada por último, com o mesmo patch).
    const parcelas = await this.listBySerie(serieId)

    // Deslocamento em meses de cada parcela em relação à editada, medido pela
    // REGRA DA FATURA (mesDaFatura): é o mês da fatura que cada parcela
    // ocupa, e ele é o que se preserva ao mover a série inteira.
    const mesAlvo = mesDaFatura(alvo, cartoes)
    const offsetDe = (t: Transacao): number => {
      const [anoA, mesA] = mesAlvo.split('-').map(Number)
      const [anoT, mesT] = mesDaFatura(t, cartoes).split('-').map(Number)
      return (anoT - anoA) * 12 + (mesT - mesA)
    }

    const baseNome = descricaoBase(data.descricao ?? alvo.descricao)

    let atualizados = 0
    for (const parcela of parcelas) {
      const off = offsetDe(parcela)
      // Nova data de competência: mesmo dia do mês escolhido, deslocado pelos
      // meses que a parcela já se afastava da editada. Dia 29/30/31 cai no
      // último dia do mês quando ele não existe.
      let novaData = ''
      if (data.data) {
        const [ano, mes, diaStr] = data.data.split('-').map(Number)
        const d = new Date(ano, mes - 1 + off, 1)
        const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
        const dia = Math.min(diaStr || 1, ultimoDia)
        novaData = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
      }

      // Sufixo "(k/n)": a base do nome é trocada; o número de cada parcela é
      // preservado (renumerar aqui não muda nada — a renumeração só ocorre em
      // recalcularParcelas, quando o TOTAL de parcelas é alterado).
      const rotulo =
        data.descricao !== undefined
          ? (parcela.parcela_numero ?? 0) > 0 && (parcela.parcela_total ?? 0) > 1
            ? `${baseNome} (${parcela.parcela_numero}/${parcela.parcela_total})`
            : baseNome
          : undefined

      const patch: Record<string, any> = {}
      if (rotulo !== undefined) patch.descricao = rotulo
      if (data.valor !== undefined) patch.valor = data.valor
      if (data.data !== undefined) patch.data = `${novaData} 12:00:00.000Z`
      if (data.cartao_id !== undefined) patch.cartao_id = data.cartao_id || null
      if (data.categoria_id !== undefined) patch.categoria_id = data.categoria_id || null
      if (data.recorrente !== undefined) patch.recorrente = Boolean(data.recorrente)

      if (parcela.id === alvo.id) {
        // A própria parcela editada: o update() do serviço sobrescreve os
        // mesmos campos (e limpa os que vieram vazios).
        await this.update(alvo.id, {
          descricao: (patch.descricao as string) ?? alvo.descricao,
          valor: (patch.valor as number) ?? alvo.valor,
          tipo: alvo.tipo,
          data: data.data ?? String(alvo.data).slice(0, 10),
          cartao_id: (patch.cartao_id as string | null) ?? alvo.cartao_id ?? null,
          categoria_id: (patch.categoria_id as string | null) ?? alvo.categoria_id ?? null,
          recorrente: (patch.recorrente as boolean) ?? alvo.recorrente,
        })
      } else {
        await pb.collection('transacoes').update(parcela.id, patch, {
          expand: 'cartao_id,categoria_id',
        })
      }
      atualizados++
    }
    return atualizados
  },

  /**
   * Recalcula o número de parcelas de uma série existente: reduz (remove as
   * que sobram) ou amplia (cria as que faltam), renomeando TODAS para "(k/n)"
   * na base do nome informada. Cada parcela guarda o mês de fatura que
   * ocupava (offset medido pela regra mesDaFatura), e as novas entram nos
   * meses seguintes à última — o mês da fatura segue a regra do vencimento do
   * cartão (gasto no dia do vencimento ou depois cai no mês seguinte).
   */
  async recalcularParcelas(
    serieId: string,
    alvo: Transacao,
    cartoes: Cartao[],
    novoTotal: number,
    dados: {
      descricao: string // nome base já SEM o sufixo "(k/n)"
      valor: number
      data: string // YYYY-MM-DD da parcela 1
      cartao_id?: string | null
      categoria_id?: string | null
      recorrente?: boolean
    },
  ): Promise<void> {
    const serie = await this.listBySerie(serieId)
    const total = Math.max(1, Math.min(24, novoTotal))
    const userId = pb.authStore.record?.id
    if (!userId) throw new Error('Usuário não autenticado')

    // Mês de fatura da parcela editada, para preservar o deslocamento
    // (em meses de FATURA) das demais em relação a ela.
    const mesAlvo = mesDaFatura(alvo, cartoes)
    const offsetDe = (t: Transacao): number => {
      const [anoA, mesA] = mesAlvo.split('-').map(Number)
      const [anoT, mesT] = mesDaFatura(t, cartoes).split('-').map(Number)
      return (anoT - anoA) * 12 + (mesT - mesA)
    }

    // Ordena a série por parcela_numero (com fallback pela data, para séries
    // antigas sem numeração limpa).
    const ordenadas = [...serie].sort((a, b) => {
      const na = a.parcela_numero ?? 1
      const nb = b.parcela_numero ?? 1
      if (na !== nb) return na - nb
      return a.data < b.data ? -1 : 1
    })

    // a) Remove as que sobram (além do novo total), as mais distantes primeiro.
    const excedentes = ordenadas.slice(total)
    for (const ex of excedentes) {
      if (ex.id === alvo.id) continue
      await pb.collection('transacoes').delete(ex.id)
    }

    // b) Atualiza as que ficam, renumerando 1..n e recalculando a data pela
    //    regra da fatura, mantendo o mês de fatura que cada uma já ocupava.
    const restantes = ordenadas.slice(0, total)
    for (let i = 0; i < restantes.length; i++) {
      const p = restantes[i]
      const k = i + 1 // nova posição na série
      const off = p.id === alvo.id ? 0 : offsetDe(p)
      const [ano, mes, diaStr] = dados.data.split('-').map(Number)
      const d = new Date(ano, mes - 1 + off, 1)
      const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
      const dia = Math.min(diaStr || 1, ultimoDia)
      const novaData = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`

      const rotulo = total > 1 ? `${dados.descricao} (${k}/${total})` : dados.descricao
      const patch: Record<string, any> = {
        descricao: rotulo,
        valor: dados.valor / total,
        data: `${novaData} 12:00:00.000Z`,
        parcela_numero: total > 1 ? k : 0,
        parcela_total: total,
        serie_id: total > 1 ? serieId : '',
      }
      if (dados.cartao_id !== undefined) patch.cartao_id = dados.cartao_id || null
      if (dados.categoria_id !== undefined) patch.categoria_id = dados.categoria_id || null
      if (dados.recorrente !== undefined) patch.recorrente = Boolean(dados.recorrente)

      if (p.id === alvo.id) {
        await this.update(p.id, {
          descricao: rotulo,
          valor: patch.valor as number,
          tipo: 'despesa',
          data: novaData,
          cartao_id: (patch.cartao_id as string | null) ?? null,
          categoria_id: (patch.categoria_id as string | null) ?? null,
          recorrente: patch.recorrente as boolean,
        })
        // O update() acima não toca em serie_id/parcela_* — grava direto:
        await pb.collection('transacoes').update(p.id, {
          parcela_numero: patch.parcela_numero,
          parcela_total: patch.parcela_total,
          serie_id: patch.serie_id,
        })
      } else {
        await pb.collection('transacoes').update(p.id, patch)
      }
    }

    // c) Cria as que faltam quando a série cresceu, entrando nos meses
    //    seguintes à última parcela que ficou (regra da fatura: a data de
    //    competência avança um mês por parcela, o mês da FATURA sai do
    //    vencimento do cartão via mesDaFatura).
    if (restantes.length < total) {
      const [ano, mes, diaStr] = dados.data.split('-').map(Number)
      for (let k = restantes.length + 1; k <= total; k++) {
        const d = new Date(ano, mes - 1 + (k - 1), 1)
        const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
        const dia = Math.min(diaStr || 1, ultimoDia)
        const dataParcela = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
        await this.create({
          descricao: total > 1 ? `${dados.descricao} (${k}/${total})` : dados.descricao,
          valor: dados.valor / total,
          tipo: 'despesa',
          data: dataParcela,
          cartao_id: dados.cartao_id || undefined,
          categoria_id: dados.categoria_id || undefined,
          recorrente: dados.recorrente,
          pago: true,
          serie_id: serieId,
          parcela_numero: k,
          parcela_total: total,
        })
      }
    }
  },

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
      serie_id: r.serie_id || undefined,
      parcela_numero: r.parcela_numero ? Number(r.parcela_numero) : undefined,
      parcela_total: r.parcela_total ? Number(r.parcela_total) : undefined,
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
    serie_id?: string
    parcela_numero?: number
    parcela_total?: number
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
        serie_id: data.serie_id || '',
        parcela_numero: data.parcela_numero,
        parcela_total: data.parcela_total,
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
      serie_id: r.serie_id || undefined,
      parcela_numero: r.parcela_numero ? Number(r.parcela_numero) : undefined,
      parcela_total: r.parcela_total ? Number(r.parcela_total) : undefined,
      created: r.created,
      updated: r.updated,
    }
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('transacoes').delete(id)
  },

  /**
   * Cria a movimentação e, quando `parcelas` > 1 no cartão, divide o valor em
   * N lançamentos mensais futuros (como no app original): a 1ª parcela usa a
   * data informada e as demais avançam um mês por vez. A regra de qual fatura
   * cada parcela entra continua sendo a do dia de vencimento (mesDaFatura).
   */
  async createComParcelas(data: {
    descricao: string
    valor: number
    tipo: TipoTransacao
    data: string // YYYY-MM-DD
    categoriaId?: string
    cartaoId?: string
    parcelas?: number
    recorrente?: boolean
  }): Promise<Transacao[]> {
    const n = Math.max(1, Math.min(24, data.parcelas || 1))
    const base = data.data.slice(0, 10)
    const [ano, mes, dia] = base.split('-').map(Number)

    const criadas: Transacao[] = []
    const serieId =
      n > 1 ? `serie:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}` : ''
    for (let i = 0; i < n; i++) {
      const d = new Date(ano, mes - 1 + i, dia)
      const dataParcela = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const descricao = n > 1 ? `${data.descricao} (${i + 1}/${n})` : data.descricao
      const criada = await this.create({
        descricao,
        valor: data.valor / n,
        tipo: data.tipo,
        data: dataParcela,
        cartao_id: data.cartaoId,
        categoria_id: data.categoriaId,
        recorrente: data.recorrente,
        pago: true,
        serie_id: serieId,
        parcela_numero: n > 1 ? i + 1 : undefined,
        parcela_total: n > 1 ? n : undefined,
      })
      criadas.push(criada)
    }
    return criadas
  },
}

/** Base do nome de uma parcela "Nome (k/n)" — '' quando não é de série. */
export const descricaoBase = (descricao: string): string => {
  const m = descricao.match(/^(.*) \((\d+)\/(\d+)\)$/)
  return m ? m[1] : ''
}
