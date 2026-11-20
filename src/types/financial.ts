export type UserPlan = 'free' | 'vip' | 'premium'

export interface User {
  id: string
  email: string
  name: string
  plan: UserPlan
  avatar?: string
  created: string
  updated: string
}

export type TipoConta = 'carteira' | 'banco' | 'cartao'

export interface Conta {
  id: string
  user_id: string
  nome: string
  tipo: TipoConta
  saldo: number
  cor?: string
  created: string
  updated: string
}

export type TipoTransacao = 'receita' | 'despesa'

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
  conta_id: string
  categoria_id?: string
  recorrente?: boolean
  recorrencia_periodo?: 'mensal' | 'anual'
  pago?: boolean
  expand?: {
    conta_id?: Conta
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
  valor_original: number
  data_contrato?: string
  mes_base_incc: string
  defasagem_meses?: number
  data_entrega?: string
  observacoes?: string
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
