import type { Imovel, FluxoImovel, ParcelaFluxo, ImovelCalculoINCC } from '@/types/financial'
import pb from '@/lib/pocketbase/client'
import { TRAVA_INCC_MESES, mesAnterior } from '@/lib/incc'

const mapImovel = (r: Record<string, unknown>): Imovel => {
  const rec = r as Record<string, string | number | boolean>
  return {
    id: String(rec.id),
    user_id: String(rec.user_id),
    nome: String(rec.nome),
    construtora: rec.construtora ? String(rec.construtora) : undefined,
    valor_original: Number(rec.valor_original),
    data_contrato: rec.data_contrato ? String(rec.data_contrato) : undefined,
    mes_base_incc: String(rec.mes_base_incc || ''),
    defasagem_meses: rec.defasagem_meses != null ? Number(rec.defasagem_meses) : undefined,
    defasagem_incc: rec.defasagem_incc != null ? Number(rec.defasagem_incc) : undefined,
    data_chaves: rec.data_chaves ? String(rec.data_chaves) : undefined,
    data_financiamento: rec.data_financiamento ? String(rec.data_financiamento) : undefined,
    data_entrega: rec.data_entrega ? String(rec.data_entrega) : undefined,
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

  async create(data: Partial<Imovel> & { nome: string; valor_original: number }): Promise<Imovel> {
    const userId = pb.authStore.record?.id
    if (!userId) throw new Error('Usuário não autenticado')
    const r = await pb.collection('imoveis').create({
      user_id: userId,
      nome: data.nome,
      construtora: data.construtora,
      valor_original: data.valor_original,
      data_contrato: data.data_contrato,
      mes_base_incc: data.mes_base_incc,
      defasagem_incc: data.defasagem_incc ?? 2,
      defasagem_meses: data.defasagem_meses ?? 2,
      data_chaves: data.data_chaves,
      data_financiamento: data.data_financiamento,
      data_entrega: data.data_entrega,
      observacoes: data.observacoes,
    })
    return mapImovel(r)
  },

  async update(id: string, data: Partial<Imovel>): Promise<Imovel> {
    return mapImovel(await pb.collection('imoveis').update(id, data))
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
  }): Promise<FluxoImovel> {
    const userId = pb.authStore.record?.id
    if (!userId) throw new Error('Usuário não autenticado')

    const fluxo = await pb.collection('imoveis_fluxos').create({
      user_id: userId,
      imovel_id: dados.imovelId,
      nome: dados.nome,
      tipo: dados.tipo,
      ordem: 99,
      valor_total: dados.valorParcela * dados.parcelas,
    })

    const lista: Record<string, unknown>[] = []
    const primeiro = new Date(dados.primeiroVencimento + 'T12:00:00Z')
    for (let i = 0; i < dados.parcelas; i++) {
      const d = new Date(primeiro)
      d.setMonth(primeiro.getMonth() + i)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const venc = `${y}-${m}`
      // TRAVA de previsibilidade: mês de referência é sempre vencimento − 2
      const mesBase = mesAnterior(venc, TRAVA_INCC_MESES)
      lista.push({
        user_id: userId,
        fluxo_id: fluxo.id,
        numero: i + 1,
        valor_base: dados.valorParcela,
        vencimento: `${venc}-01 12:00:00.000Z`,
        mes_base: mesBase,
        pago: false,
      })
    }
    await pb.collection('imoveis_fluxo_parcelas').create(lista)

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
