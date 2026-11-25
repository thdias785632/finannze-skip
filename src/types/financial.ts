export type UserPlan = 'free' | 'vip' | 'premium'

export interface User {
  id: string
  email: string
  name: string
  plan: UserPlan
  telefone?: string
  avatar?: string
  created: string
  updated: string
}

export interface Cartao {
  id: string
  user_id: string
  nome: string
  /** Dia do mês (1-31) do vencimento da fatura. Compras no dia do vencimento ou depois caem na fatura do mês seguinte. */
  dia_vencimento: number
  cor?: string
  created: string
  updated: string
}

export type TipoTransacao = 'receita' | 'despesa'

/** Quanto do valor de uma transação cabe a cada membro do grupo. */
export interface TransacaoDivisao {
  id: string
  transacao_id: string
  user_id: string
  valor: number
}

export interface Categoria {
  id: string
  nome: string
  cor: string
  tipo?: 'receita' | 'despesa' | 'ambos'
  icone?: string
  user_id?: string
  created: string
  updated: string
}

export interface Transacao {
  id: string
  user_id: string
  descricao: string
  valor: number
  tipo: TipoTransacao
  data: string
  cartao_id?: string
  categoria_id?: string
  recorrente?: boolean
  recorrencia_periodo?: 'mensal' | 'anual'
  pago?: boolean
  /**
   * Identificador da série de parcelas (compra parcelada): as transações de
   * uma mesma compra compartilham o mesmo valor. Vazio em lançamentos avulsos.
   */
  serie_id?: string
  /** Número da parcela dentro da série (1-based); ausente fora de séries. */
  parcela_numero?: number
  /** Total de parcelas da série; ausente fora de séries. */
  parcela_total?: number
  /**
   * Divisão da transação entre membros do grupo: quanto do valor vai para
   * cada pessoa (o restante, se sobrar, é do dono). Vazio = só do usuário.
   */
  divisoes?: TransacaoDivisao[]
  /** Usuários (membros do grupo) com quem o valor foi dividido. */
  dividido_com?: string[]
  /** true quando a transação foi criada por outra pessoa e compartilhada comigo */
  compartilhada?: boolean
  expand?: {
    cartao_id?: Cartao
    categoria_id?: Categoria
  }
  created: string
  updated: string
}

export interface Imovel {
  id: string
  user_id: string
  nome: string
  construtora?: string
  /** Valor informado na criação; ausente = derivado da soma dos fluxos. */
  valor_original?: number
  data_contrato?: string
  mes_base_incc: string
  defasagem_meses?: number
  /** Defasagem do INCC: quantos meses antes do vencimento o índice é aplicado. */
  defasagem_incc?: number
  /** Meses de referência do INCC: quantos meses antes do vencimento (editável). */
  incc_meses_referencia?: number
  data_chaves?: string
  data_financiamento?: string
  data_entrega?: string
  observacoes?: string
  /** Usuários (membros do grupo) com acesso de ver e editar ao imóvel. */
  compartilhado_com?: string[]
  /** true quando o imóvel foi criado por outra pessoa e compartilhado comigo */
  compartilhado?: boolean
  created: string
  updated: string
}

export type TipoFluxo = 'entrada' | 'sinal' | 'anual' | 'mensal' | 'financiamento'

export interface FluxoImovel {
  id: string
  user_id: string
  imovel_id: string
  nome: string
  tipo: TipoFluxo
  ordem?: number
  valor_total?: number
  created: string
  updated: string
}

export interface ParcelaFluxo {
  id: string
  user_id: string
  fluxo_id: string
  numero?: number
  valor_base: number
  vencimento: string
  /** Mês (YYYY-MM) do índice INCC aplicado nesta parcela. */
  mes_base?: string
  pago: boolean
  created: string
  updated: string
}

export interface ImovelCalculoINCC {
  valorOriginal: number
  valorCorrigido: number
  correcaoAcumulada: number
  percentualAcumulado: number
  mesBase: string
  mesReferencia: string
  defasagemMeses: number
  mesesAplicadosCount: number
  historico: Array<{
    mes: string
    variacao: number
  }>
}

export interface IndiceINCC {
  id: string
  mes: string
  data_referencia: string
  variacao_mensal: number
  fonte?: string
}

/** Uma fatia da divisão de uma transação entre membros do grupo. */
export interface TransacaoDivisao {
  id: string
  transacao_id: string
  user_id: string
  valor: number
}
