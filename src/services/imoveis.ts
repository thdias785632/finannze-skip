import type { Imovel, FluxoImovel, ParcelaFluxo, ImovelCalculoINCC } from '@/types/financial'
import pb from '@/lib/pocketbase/client'
import { TRAVA_INCC_MESES_PADRAO, mesAnterior } from '@/lib/incc'

const mapImovel = (r: Record<string, unknown>): Imovel => {
  const rec = r as Record<string, string | number | boolean>
  return {
    id: String(rec.id),
    user_id: String(rec.user_id),
    nome: String(rec.nome),
    construtora: rec.construtora ? String(rec.construtora) : undefined,
    valor_original:
      rec.valor_original != null && rec.valor_original !== ''
        ? Number(rec.valor_original)
        : undefined,
    compartilhado_com: Array.isArray(rec.compartilhado_com)
      ? (rec.compartilhado_com as string[])
      : undefined,
    compartilhado: Boolean(rec.user_id) && rec.user_id !== pb.authStore.record?.id,
    data_contrato: rec.data_contrato ? String(rec.data_contrato) : undefined,
    mes_base_incc: String(rec.mes_base_incc || ''),
    defasagem_meses: rec.defasagem_meses != null ? Number(rec.defasagem_meses) : undefined,
    defasagem_incc: rec.defasagem_incc != null ? Number(rec.defasagem_incc) : undefined,
    data_chaves: rec.data_chaves ? String(rec.data_chaves) : undefined,
    data_financiamento: rec.data_financiamento ? String(rec.data_financiamento) : undefined,
    data_entrega: rec.data_entrega ? String(rec.data_entrega) : undefined,
    incc_meses_referencia:
      rec.incc_meses_referencia != null && rec.incc_meses_referencia !== ''
        ? Number(rec.incc_meses_referencia)
        : TRAVA_INCC_MESES_PADRAO,
    observacoes: rec.observacoes ? String(rec.observacoes) : undefined,
    created: String(rec.created),
    updated: String(rec.updated),
  }
}

export const imoveisService = {
  async list(): Promise<Imovel[]> {
    const records = await pb.collection('imoveis').getFullList({ sort: '-created' })
    return records.map(mapImovel)
  },

  async get(id: string): Promise<Imovel> {
    return mapImovel(await pb.collection('imoveis').getOne(id))
  },

  async create(data: Partial<Imovel> & { nome: string; valor_original?: number }): Promise<Imovel> {
    const userId = pb.authStore.record?.id
    if (!userId) throw new Error('Usuário não autenticado')
    const r = await pb.collection('imoveis').create({
      user_id: userId,
      nome: data.nome,
      construtora: data.construtora,
      valor_original: data.valor_original != null ? Number(data.valor_original) : undefined,
      compartilhado_com: data.compartilhado_com,
      data_contrato: data.data_contrato,
      mes_base_incc: data.mes_base_incc,
      defasagem_incc: data.defasagem_incc ?? 2,
      defasagem_meses: data.defasagem_meses ?? 2,
      incc_meses_referencia: data.incc_meses_referencia ?? TRAVA_INCC_MESES_PADRAO,
      data_chaves: data.data_chaves,
      data_financiamento: data.data_financiamento,
      data_entrega: data.data_entrega,
      observacoes: data.observacoes,
    })
    return mapImovel(r)
  },

  async update(id: string, data: Partial<Imovel>): Promise<Imovel> {
    const payload: Record<string, unknown> = {}
    if (data.nome !== undefined) payload.nome = data.nome
    if (data.construtora !== undefined) payload.construtora = data.construtora
    if (data.valor_original !== undefined)
      payload.valor_original = data.valor_original != null ? Number(data.valor_original) : null
    if (data.compartilhado_com !== undefined) payload.compartilhado_com = data.compartilhado_com
    if (data.data_contrato !== undefined) payload.data_contrato = data.data_contrato
    if (data.mes_base_incc !== undefined) payload.mes_base_incc = data.mes_base_incc
    if (data.defasagem_incc !== undefined) payload.defasagem_incc = data.defasagem_incc
    if (data.defasagem_meses !== undefined) payload.defasagem_meses = data.defasagem_meses
    if (data.incc_meses_referencia !== undefined)
      payload.incc_meses_referencia = data.incc_meses_referencia
    if (data.data_chaves !== undefined) payload.data_chaves = data.data_chaves
    if (data.data_financiamento !== undefined) payload.data_financiamento = data.data_financiamento
    if (data.data_entrega !== undefined) payload.data_entrega = data.data_entrega
    if (data.observacoes !== undefined) payload.observacoes = data.observacoes
    return mapImovel(await pb.collection('imoveis').update(id, payload))
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('imoveis').delete(id)
  },

  /** Fluxos de um imóvel */
  async listarFluxos(imovelId: string): Promise<FluxoImovel[]> {
    const records = await pb.collection('imoveis_fluxos').getFullList({
      filter: `imovel_id = "${imovelId}"`,
      sort: 'ordem,created',
    })
    return records.map(
      (r): FluxoImovel => ({
        id: r.id,
        user_id: r.user_id,
        imovel_id: r.imovel_id,
        nome: r.nome,
        tipo: r.tipo,
        ordem: r.ordem != null ? Number(r.ordem) : undefined,
        valor_total: r.valor_total != null ? Number(r.valor_total) : undefined,
        created: r.created,
        updated: r.updated,
      }),
    )
  },

  /** Cria um fluxo com N parcelas mensais, corrigidas pelo INCC. */
  async criarFluxo(dados: {
    imovelId: string
    nome: string
    tipo: FluxoImovel['tipo']
    parcelas: number
    valorParcela: number
    primeiroVencimento: string // YYYY-MM-DD
    defasagemIncc: number
    /** meses antes do vencimento cujo INCC aplica na parcela (padrão 2) */
    mesesReferencia?: number
  }): Promise<FluxoImovel> {
    const userId = pb.authStore.record?.id
    if (!userId) throw new Error('Usuário não autenticado')

    const mesesReferencia = dados.mesesReferencia ?? TRAVA_INCC_MESES_PADRAO

    const fluxo = await pb.collection('imoveis_fluxos').create({
      user_id: userId,
      imovel_id: dados.imovelId,
      nome: dados.nome,
      tipo: dados.tipo,
      ordem: 99,
      valor_total: dados.valorParcela * dados.parcelas,
    })

    // A API de records do PocketBase não aceita array como payload de create:
    // cria as parcelas uma a uma (o lote com array voltava 400 e o fluxo
    // ficava salvo SEM parcelas — bug "não consegui cadastrar um fluxo").
    const primeiro = new Date(dados.primeiroVencimento + 'T12:00:00Z')
    for (let i = 0; i < dados.parcelas; i++) {
      const d = new Date(primeiro)
      d.setMonth(primeiro.getMonth() + i)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const venc = `${y}-${m}`
      // Mês de referência: vencimento − N (configurável por imóvel, padrão 2)
      const mesBase = mesAnterior(venc, mesesReferencia)
      await pb.collection('imoveis_fluxo_parcelas').create({
        user_id: userId,
        fluxo_id: fluxo.id,
        numero: i + 1,
        valor_base: dados.valorParcela,
        vencimento: `${venc}-01 12:00:00.000Z`,
        mes_base: mesBase,
        pago: false,
      })
    }
    return {
      id: fluxo.id,
      user_id: fluxo.user_id,
      imovel_id: fluxo.imovel_id,
      nome: fluxo.nome,
      tipo: fluxo.tipo,
      ordem: fluxo.ordem != null ? Number(fluxo.ordem) : undefined,
      valor_total: fluxo.valor_total != null ? Number(fluxo.valor_total) : undefined,
      created: fluxo.created,
      updated: fluxo.updated,
    }
  },

  async excluirFluxo(fluxoId: string): Promise<void> {
    await pb.collection('imoveis_fluxos').delete(fluxoId)
  },

  async listarParcelas(fluxoIds: string[]): Promise<ParcelaFluxo[]> {
    if (fluxoIds.length === 0) return []
    const filtro = fluxoIds.map((id) => `fluxo_id = "${id}"`).join(' || ')
    const records = await pb.collection('imoveis_fluxo_parcelas').getFullList({
      filter: filtro,
      sort: 'vencimento,numero',
    })
    return records.map(
      (r): ParcelaFluxo => ({
        id: r.id,
        user_id: r.user_id,
        fluxo_id: r.fluxo_id,
        numero: r.numero != null ? Number(r.numero) : undefined,
        valor_base: Number(r.valor_base),
        vencimento: r.vencimento,
        mes_base: r.mes_base ? String(r.mes_base) : undefined,
        pago: !!r.pago,
        created: r.created,
        updated: r.updated,
      }),
    )
  },

  async pagarParcela(parcelaId: string, pago: boolean): Promise<void> {
    await pb.collection('imoveis_fluxo_parcelas').update(parcelaId, { pago })
  },

  async removerParcela(parcelaId: string): Promise<void> {
    await pb.collection('imoveis_fluxo_parcelas').delete(parcelaId)
  },

  /** Índices INCC armazenados no backend (mes "YYYY-MM" → variação % mensal) */
  async listarIndicesINCC(): Promise<Record<string, number>> {
    const records = await pb.collection('indices_incc').getFullList({ sort: 'mes' })
    const map: Record<string, number> = {}
    for (const r of records) map[r.mes] = Number(r.variacao_mensal)
    return map
  },

  /** Dispara a sincronização do INCC com o Banco Central (SGS 192). */
  async sincronizarINCC(): Promise<void> {
    await pb.send('/backend/v1/incc/sync', { method: 'GET' })
  },
}

export type { ImovelCalculoINCC }
