import pb from '@/lib/pocketbase/client'
import type { Transacao, TipoTransacao, Cartao, TransacaoDivisao } from '@/types/financial'
import { gruposService } from '@/services/grupos'

import { ajusteVigente, mesDe } from '@/services/fechamentoAjuste'

/**
 * Regra da fatura: um lançamento feito no dia do FECHAMENTO do cartão ou
 * depois cai na fatura do mês SEGUINTE. Receitas não têm cartão — usam o mês
 * da própria data.
 *
 * Ex.: cartão com fechamento dia 10 → compra de 10/05 aparece no extrato de
 * junho; compra de 09/05 aparece em maio.
 *
 * Se o cartão tem ajuste pontual de fechamento para o mês da COMPRA (campo
 * `fechamento_ajustado`), esse dia ajustado é que decide a fatura.
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
    const ajuste = cartao ? ajusteVigente(cartao, mesDe(d)) : null
    const diaFech = ajuste ? ajuste.getDate() : cartao?.dia_vencimento
    if (cartao && diaFech && d.getDate() >= diaFech) {
      mes += 1
      if (mes > 11) {
        mes = 0
        ano += 1
      }
    }
  }
  return `${ano}-${String(mes + 1).padStart(2, '0')}`
}

/**
 * Mês (YYYY-MM) de COMPETÊNCIA de uma transação — sem a regra da fatura:
 * apenas o mês da data do lançamento. Usado pela réplica de recorrentes.
 */
export const mesDaCompetencia = (transacao: Pick<Transacao, 'data'>): string => {
  const d = new Date(transacao.data)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
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
  dividido_com: Array.isArray(r.dividido_com) ? (r.dividido_com as string[]) : undefined,
  expand: {
    cartao_id: r.expand?.cartao_id
      ? {
          id: r.expand.cartao_id.id,
          user_id: r.expand.cartao_id.user_id,
          nome: r.expand.cartao_id.nome,
          dia_vencimento: Number(r.expand.cartao_id.dia_vencimento),
          fechamento_ajustado: r.expand.cartao_id.fechamento_ajustado || undefined,
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
   * Grava a divisão da transação entre membros do grupo: apaga as divisões
   * anteriores e cria uma linha em transacoes_divisoes por membro escolhido,
   * além de gravar dividido_com na própria transação (é o que dá acesso do
   * membro ao lançamento e o que aparece na lista dele). O restante do valor
   * (se sobrar) fica com o dono.
   */
  async salvarDivisoes(
    transacaoId: string,
    valorTotal: number,
    membros: { user_id: string; valor: number }[],
  ): Promise<void> {
    const atuais = await pb.collection('transacoes_divisoes').getFullList({
      filter: `transacao_id = "${transacaoId}"`,
    })
    for (const d of atuais) {
      await pb.collection('transacoes_divisoes').delete(d.id)
    }
    if (membros.length === 0) {
      // Sem divisão: limpa também dividido_com na transação.
      await pb.collection('transacoes').update(transacaoId, { dividido_com: [] })
      return
    }
    // A API aceita UM registro por create — um array de objetos gera 400 e
    // nada é gravado. Um create por linha de divisão.
    for (const m of membros.filter((m) => m.user_id && m.valor > 0)) {
      await pb.collection('transacoes_divisoes').create({
        transacao_id: transacaoId,
        user_id: m.user_id,
        valor: m.valor,
      })
    }
    await pb.collection('transacoes').update(transacaoId, {
      dividido_com: membros.map((m) => m.user_id),
    })
  },

  /** Divisões gravadas de uma transação (vazio = não dividida). */
  async listarDivisoes(transacaoId: string): Promise<TransacaoDivisao[]> {
    const records = await pb.collection('transacoes_divisoes').getFullList({
      filter: `transacao_id = "${transacaoId}"`,
    })
    return records.map((r) => ({
      id: r.id,
      transacao_id: r.transacao_id,
      user_id: r.user_id,
      valor: Number(r.valor),
    }))
  },

  /**
   * Grava a divisão junto com a criação/edição da transação. Aceita o id da
   * transação OU a própria transação recém-criada/recriada: quando a operação
   * gerou uma SÉRIE (parcelas), a divisão é replicada para TODAS as parcelas
   * da série — cada parcela fica dividida com as mesmas pessoas, nas mesmas
   * proporções, e o lançamento aparece na lista de cada membro.
   */
  async aplicarDivisao(
    alvo: Transacao | { id: string; valor: number; serie_id?: string },
    divisao: { user_id: string; valor: number }[],
  ): Promise<void> {
    if (divisao.length === 0) {
      // Sem divisão: garante dividido_com limpo (idempotente).
      await pb.collection('transacoes').update(alvo.id, { dividido_com: [] })
      return
    }
    if (alvo.serie_id) {
      const serie = await this.listBySerie(alvo.serie_id)
      for (const parcela of serie) {
        await this.salvarDivisoes(
          parcela.id,
          parcela.valor,
          divisao.map((d) => ({
            user_id: d.user_id,
            valor: (parcela.valor / Math.max(alvo.valor, 0.000001)) * d.valor,
          })),
        )
      }
      return
    }
    await this.salvarDivisoes(alvo.id, alvo.valor, divisao)
  },

  /** Divisões de todas as transações informadas, agrupadas por transacao_id. */
  async listarDivisoesDeVarias(ids: string[]): Promise<Record<string, TransacaoDivisao[]>> {
    const resultado: Record<string, TransacaoDivisao[]> = {}
    if (ids.length === 0) return resultado
    const filtro = ids.map((id) => `transacao_id = "${id}"`).join(' || ')
    const records = await pb
      .collection('transacoes_divisoes')
      .getFullList({ filter: filtro })
      .catch(() => [] as Record<string, any>[])
    for (const r of records) {
      const chave = String(r.transacao_id)
      ;(resultado[chave] ||= []).push({
        id: r.id,
        transacao_id: chave,
        user_id: r.user_id,
        valor: Number(r.valor),
      })
    }
    return resultado
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
   * Edição de série por APAGAR-AND-RECRIAR: TODAS as transações da série são
   * EXCLUÍDAS do banco (inclusive as já pagas — sem tratamento especial) e a
   * série é recriada do zero a partir dos dados do formulário: novo valor
   * total (dividido pelo novo número de parcelas), nova data (que é o início
   * da parcela 1), novo número de parcelas, cartão, nome, categoria e
   * recorrente. Cada parcela recriada segue a regra da fatura já usada na
   * criação (mesDaFatura: gasto no dia do vencimento ou depois cai na fatura
   * do mês seguinte), com descrição "Nome (k/n)" e os campos
   * serie_id/parcela_numero/parcela_total gravados.
   *
   * Com 1 parcela (ou sem parcelas), a série some: vira um lançamento único,
   * sem sufixo "(k/n)" e sem serie_id. Um lançamento único que passa a ter
   * parcelas ganha sua própria série nova.
   */
  async recriarSerie(
    alvo: Transacao,
    dados: {
      descricao: string
      valor: number
      data: string // YYYY-MM-DD da parcela 1
      cartao_id?: string | null
      categoria_id?: string | null
      recorrente?: boolean
      parcelas: number
    },
    divisao?: { user_id: string; valor: number }[],
  ): Promise<number> {
    const userId = pb.authStore.record?.id
    if (!userId) throw new Error('Usuário não autenticado')

    // 1) Exclui TODAS as transações da série — sem exceção, pagas ou não (a
    //    própria parcela editada inclusa). Alvo sem série: exclui só ele.
    const serie = alvo.serie_id ? await this.listBySerie(alvo.serie_id) : []
    const ids = new Set<string>(serie.map((p) => p.id))
    ids.add(alvo.id)
    for (const idExcluir of ids) {
      // As divisões (transacoes_divisoes) das parcelas antigas são apagadas
      // junto — as regras da coleção permitem apagar quando sou o dono da
      // transação ou o usuário da divisão.
      const antigas = await pb
        .collection('transacoes_divisoes')
        .getFullList({ filter: `transacao_id = "${idExcluir}"` })
        .catch(() => [] as Record<string, any>[])
      for (const d of antigas) {
        await pb
          .collection('transacoes_divisoes')
          .delete(d.id)
          .catch(() => {})
      }
      await pb.collection('transacoes').delete(idExcluir)
    }

    // 2) Recria do zero: uma parcela por mês a partir da data informada (dia
    //    29/30/31 cai no último dia do mês quando ele não existe). O mês da
    //    FATURA de cada uma sai da regra do vencimento (mesDaFatura).
    const n = Math.max(1, Math.min(24, dados.parcelas || 1))
    const [ano, mes, diaStr] = dados.data.slice(0, 10).split('-').map(Number)
    const novaSerieId =
      n > 1
        ? alvo.serie_id ||
          `serie:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
        : ''

    const criadas: Transacao[] = []
    for (let k = 1; k <= n; k++) {
      const d = new Date(ano, mes - 1 + (k - 1), 1)
      const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
      const dia = Math.min(diaStr || 1, ultimoDia)
      const dataParcela = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`

      const criada = await this.create({
        descricao: n > 1 ? `${dados.descricao} (${k}/${n})` : dados.descricao,
        valor: dados.valor / n,
        tipo: 'despesa',
        data: dataParcela,
        cartao_id: dados.cartao_id || undefined,
        categoria_id: dados.categoria_id || undefined,
        recorrente: dados.recorrente,
        pago: false,
        serie_id: novaSerieId,
        parcela_numero: n > 1 ? k : undefined,
        parcela_total: n > 1 ? n : undefined,
      })
      criadas.push(criada)
    }

    // 3) Divisão: replicada para todas as parcelas da série recriada — cada
    //    parcela leva a mesma proporção do total definida no formulário.
    if (divisao && divisao.length > 0 && dados.valor > 0) {
      const valorParcela = dados.valor / n
      for (const parcela of criadas) {
        await this.salvarDivisoes(
          parcela.id,
          parcela.valor,
          divisao.map((d) => ({
            user_id: d.user_id,
            valor: Math.round((d.valor / dados.valor) * valorParcela * 100) / 100,
          })),
        )
      }
    }
    return n
  },

  /**
   * Lista transações. Com `mes` (YYYY-MM), aplica a regra da fatura: cada
   * despesa com cartão é atribuída ao mês de vencimento da respectiva fatura,
   * e o resultado é ordenado por data. Sem `mes`, retorna tudo.
   *
   * Recorrentes valem para todos os meses a partir do mês da data original:
   * além do lançamento original (que aparece UMA ÚNICA VEZ, no seu mês real),
   * cada lançamento recorrente é replicado nos meses seguintes navegáveis —
   * sem gravar nada no banco (réplica virtual, em memória). Período "anual"
   * só replica nos meses de mesmo número (a cada 12 meses).
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
    const doMes = all.filter((t) => mesDaFatura(t, cartoes) === filters.mes)

    // Réplica virtual dos recorrentes para este mês de referência. O
    // lançamento original nunca é duplicado: se ele já cai no mês (pela data
    // ou pela regra da fatura), não gera réplica.
    const idsNoMes = new Set(doMes.map((t) => t.id))
    for (const t of all) {
      if (idsNoMes.has(t.id) || !t.recorrente) continue
      const mesOrigem = mesDaCompetencia(t)
      if (mesOrigem >= filters.mes) continue // mês real e anteriores: nada a replicar
      if ((t.recorrencia_periodo || 'mensal') === 'anual') {
        // Anual: só nos meses de mesmo número (ex.: todo dezembro).
        if (mesOrigem.slice(5) !== filters.mes.slice(5)) continue
      }
      idsNoMes.add(t.id)
      doMes.push(t)
    }

    return doMes.sort((a, b) => (a.data < b.data ? 1 : -1))
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
      dividido_com: Array.isArray(r.dividido_com) ? (r.dividido_com as string[]) : undefined,
      compartilhada: Boolean(r.user_id) && r.user_id !== pb.authStore.record?.id,
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
    dividido_com?: string[]
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
        ...(data.dividido_com && data.dividido_com.length > 0
          ? { dividido_com: data.dividido_com }
          : {}),
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
   * Exclusão de despesa de cartão. Com escopo 'uma', remove APENAS o
   * lançamento informado — as demais parcelas da série ficam intocadas, cada
   * uma no seu mês de fatura (nada é recalculado ou renomeado; os sufixos
   * "(k/n)" permanecem como estão). Com escopo 'todas', remove todos os
   * lançamentos que compartilham o serie_id. NÃO usa recriarSerie.
   */
  async excluir(alvo: Transacao, escopo: 'uma' | 'todas'): Promise<string[]> {
    const apagarDivisoes = async (transacaoId: string) => {
      const antigas = await pb
        .collection('transacoes_divisoes')
        .getFullList({ filter: `transacao_id = "${transacaoId}"` })
        .catch(() => [] as Record<string, any>[])
      for (const d of antigas) {
        await pb
          .collection('transacoes_divisoes')
          .delete(d.id)
          .catch(() => {})
      }
    }
    if (escopo === 'uma' || !alvo.serie_id) {
      await apagarDivisoes(alvo.id)
      await this.delete(alvo.id)
      return [alvo.id]
    }
    const serie = await this.listBySerie(alvo.serie_id)
    const ids = serie.map((p) => p.id)
    for (const id of ids) {
      await apagarDivisoes(id)
      await this.delete(id)
    }
    return ids
  },

  /**
   * Cria a movimentação e, quando `parcelas` > 1 no cartão, divide o valor em
   * N lançamentos mensais futuros (como no app original): a 1ª parcela usa a
   * data informada e as demais avançam um mês por vez. A regra de qual fatura
   * cada parcela entra continua sendo a do dia de vencimento (mesDaFatura).
   */
  async createComParcelas(
    data: {
      descricao: string
      valor: number
      tipo: TipoTransacao
      data: string // YYYY-MM-DD
      categoriaId?: string
      cartaoId?: string
      parcelas?: number
      recorrente?: boolean
      divididoCom?: string[]
    },
    divisao?: { user_id: string; valor: number }[],
  ): Promise<Transacao[]> {
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
        dividido_com: data.divididoCom,
      })
      criadas.push(criada)
    }

    // Divisão: replicada para todas as parcelas da série criada.
    if (divisao && divisao.length > 0 && data.valor > 0) {
      const valorParcela = data.valor / n
      for (const parcela of criadas) {
        await this.salvarDivisoes(
          parcela.id,
          parcela.valor,
          divisao.map((d) => ({
            user_id: d.user_id,
            valor: Math.round((d.valor / data.valor) * valorParcela * 100) / 100,
          })),
        )
      }
    }
    return criadas
  },
}

/** Base do nome de uma parcela "Nome (k/n)" — '' quando não é de série. */
export const descricaoBase = (descricao: string): string => {
  const m = descricao.match(/^(.*) \((\d+)\/(\d+)\)$/)
  return m ? m[1] : ''
}
