import type { Imovel, ParcelaFluxo, FluxoImovel } from '@/types/financial'

/**
 * Cálculo de correção INCC para os fluxos de um imóvel.
 *
 * REGRA DE NEGÓCIO (fonte da verdade — definida pelo usuário):
 *
 * 1. CARREGO = número de meses entre a assinatura do contrato do imóvel
 *    (mês-base) e o mês de vencimento da parcela.
 *    Ex.: contrato nov/2026, parcela jan/2027 → 2 meses de carrego.
 *
 * 2. TRAVA DE PREVISIBILIDADE: a taxa de referência de cada parcela é SEMPRE
 *    o INCC do mês 2 MESES ANTES do vencimento (não 1, não configurável).
 *    Parcela jan/2027 → INCC de nov/2026, aplicado × 2 (os 2 meses de carrego).
 *    Quando o INCC de nov/2026 for divulgado, o fluxo de jan/2027 fica
 *    DEFINITIVO (nov × 2, sem estimativa) — e a parcela de dez/2027 passa a
 *    usar o INCC de novembro também, e assim por diante.
 *
 * 3. FALLBACK: se o índice mensal de referência ainda NÃO existe no banco,
 *    usa a MÉDIA do INCC do ano corrente como estimativa e marca o valor como
 *    ESTIMADO (valor aproximado até existirem todos os índices reais).
 *
 * 4. Fórmula: correção = valor_base × (taxa_referência × meses_de_carrego)
 *    Ex.: 8000 × (0,61% × 2) ≈ R$ 97,60.
 *
 * 5. Os índices vêm da API pública do Banco Central (série SGS 192, INCC) e
 *    ficam gravados na coleção `indices_incc` do PocketBase.
 */

export interface IndiceINCC {
  [mes: string]: number // "YYYY-MM" → variação % mensal
}

export interface ParcelaCalculada {
  parcela: ParcelaFluxo
  /** Taxa de referência aplicada (única, trava de 2 meses antes do vencimento). */
  taxaReferencia: { mes: string; variacao: number; estimado: boolean } | null
  /** fator de correção total aplicado (1.0 = sem correção) */
  fator: number
  /** valor base da parcela (sem correção) */
  valorBase: number
  /** correção monetária em R$ (valorCorrigido − valorBase) */
  correcao: number
  /** valor corrigido (real quando o índice de referência existe; estimado caso contrário) */
  valorCorrigido: number
  /** true quando o índice de referência ainda não foi divulgado (valor é estimativa) */
  estimado: boolean
  /** taxa mensal aplicada em % (real ou estimada pela média) */
  taxaUsada: number
  /** mês de vencimento da parcela, "YYYY-MM" */
  mesVenc: string
  /** meses de carrego: meses entre a assinatura do contrato e o vencimento */
  mesesCarrego: number
  /** mês de referência da taxa, "YYYY-MM" (vencimento − 2) */
  mesReferencia: string
}

export interface FluxoCalculado {
  fluxo: FluxoImovel
  parcelas: ParcelaCalculada[]
  totalBase: number
  totalCorrigido: number
  totalPago: number
  totalRestante: number
  qtdePaga: number
  estimado: boolean
}

export interface ImovelCalculado {
  imovel: Imovel
  fluxos: FluxoCalculado[]
  totalPago: number
  totalRestante: number
  /** Soma corrigida de tudo que falta pagar (saldo a pagar) */
  saldoCorrigido: number
  /** "Saldo a pagar" da tela — usado no cartão roxo */
  totalContrato: number
  totalParcelas: number
  parcelasPagas: number
  /** Próxima parcela não paga (a mais próxima no tempo) */
  proxima?: ParcelaCalculada
  estimado: boolean
}

/** trava de previsibilidade: padrão de meses antes do vencimento (editável por imóvel) */
export const TRAVA_INCC_MESES_PADRAO = 2

/** mês atual no formato "YYYY-MM" */
export const mesAtual = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export const mesAnterior = (mes: string, n = 1): string => {
  const [y, m] = mes.split('-').map(Number)
  const d = new Date(y, m - 1 - n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** diferença em meses entre dois meses "YYYY-MM" (ate − de) */
export const diferencaMeses = (de: string, ate: string): number => {
  const [y1, m1] = de.split('-').map(Number)
  const [y2, m2] = ate.split('-').map(Number)
  return y2 * 12 + m2 - (y1 * 12 + m1)
}

/**
 * Mês-base do contrato (assinatura) em "YYYY-MM": prioriza `mes_base_incc`
 * e cai para a data do contrato quando o campo não foi preenchido.
 */
export const mesBaseContrato = (imovel: Imovel): string => {
  if (imovel.mes_base_incc) return imovel.mes_base_incc.slice(0, 7)
  if (imovel.data_contrato) {
    const d = new Date(imovel.data_contrato)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  return ''
}

/**
 * Média do INCC do ANO CORRENTE — usada como estimativa para índices que o
 * Banco Central ainda não divulgou. Calculada dinamicamente dos índices reais
 * já gravados no banco; quando o ano corrente ainda não tem nenhum índice,
 * usa a média dos últimos 12 índices disponíveis (nunca valor fixo).
 */
export const mediaInccAnoCorrente = (indices: IndiceINCC): number => {
  const ano = new Date().getFullYear()
  const vars: number[] = []
  for (let m = 1; m <= 12; m++) {
    const chave = `${ano}-${String(m).padStart(2, '0')}`
    if (indices[chave] != null) vars.push(indices[chave])
  }
  if (vars.length > 0) return vars.reduce((a, b) => a + b, 0) / vars.length

  // Fallback: últimos 12 índices reais disponíveis (mais recentes primeiro)
  const maisRecentes = Object.keys(indices)
    .filter((k) => indices[k] != null)
    .sort()
    .slice(-12)
  if (maisRecentes.length === 0) return 0
  return maisRecentes.reduce((s, k) => s + indices[k], 0) / maisRecentes.length
}

/**
 * Corrige uma parcela pela regra do INCC com trava de 2 meses:
 *
 *   mesesCarrego  = meses entre a assinatura do contrato e o vencimento
 *   mesReferencia = vencimento − 2 (TRAVA, sempre 2)
 *   taxa          = INCC real de mesReferencia, ou a média do ano corrente
 *                   quando o índice ainda não existe (estimado)
 *   correção      = valor_base × (taxa × mesesCarrego)
 */
export const calcularParcela = (
  parcela: ParcelaFluxo,
  imovel: Imovel,
  indices: IndiceINCC,
  mediaAnoCorrente: number,
  mesesReferencia: number = TRAVA_INCC_MESES_PADRAO,
): ParcelaCalculada => {
  const venc = new Date(parcela.vencimento)
  const mesVenc = `${venc.getFullYear()}-${String(venc.getMonth() + 1).padStart(2, '0')}`

  // TRAVA: referência sempre N meses antes do vencimento (padrão 2)
  const mesReferencia = mesAnterior(mesVenc, mesesReferencia)

  // CARREGO: meses entre a assinatura do contrato e o vencimento
  const assinatura = mesBaseContrato(imovel)
  const mesesCarrego = assinatura && assinatura < mesVenc ? diferencaMeses(assinatura, mesVenc) : 0

  const valorBase = parcela.valor_base
  const real = indices[mesReferencia]
  const existeIndice = real != null

  const taxaUsada = existeIndice ? real : mediaAnoCorrente
  const fator = 1 + (taxaUsada / 100) * mesesCarrego
  const valorCorrigido = valorBase * fator

  return {
    parcela,
    taxaReferencia: { mes: mesReferencia, variacao: taxaUsada, estimado: !existeIndice },
    fator,
    valorBase,
    correcao: valorCorrigido - valorBase,
    valorCorrigido,
    estimado: !existeIndice && mesesCarrego > 0,
    taxaUsada,
    mesVenc,
    mesesCarrego,
    mesReferencia,
  }
}

export const calcularFluxo = (
  fluxo: FluxoImovel,
  parcelas: ParcelaFluxo[],
  imovel: Imovel,
  indices: IndiceINCC,
  mediaAnoCorrente: number,
  mesesReferencia: number = TRAVA_INCC_MESES_PADRAO,
): FluxoCalculado => {
  const calculadas = parcelas
    .filter((p) => p.fluxo_id === fluxo.id)
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
    .map((p) => calcularParcela(p, imovel, indices, mediaAnoCorrente, mesesReferencia))

  const totalBase = calculadas.reduce((s, p) => s + p.valorBase, 0)
  const totalCorrigido = calculadas.reduce((s, p) => s + p.valorCorrigido, 0)
  const totalPago = calculadas
    .filter((p) => p.parcela.pago)
    .reduce((s, p) => s + p.valorCorrigido, 0)
  const totalRestante = calculadas
    .filter((p) => !p.parcela.pago)
    .reduce((s, p) => s + p.valorCorrigido, 0)

  return {
    fluxo,
    parcelas: calculadas,
    totalBase,
    totalCorrigido,
    totalPago,
    totalRestante,
    qtdePaga: calculadas.filter((p) => p.parcela.pago).length,
    estimado: calculadas.some((p) => p.estimado),
  }
}

export const calcularImovel = (
  imovel: Imovel,
  fluxos: FluxoImovel[],
  parcelas: ParcelaFluxo[],
  indices: IndiceINCC,
): ImovelCalculado => {
  const media = mediaInccAnoCorrente(indices)
  const mesesRef = imovel.incc_meses_referencia ?? TRAVA_INCC_MESES_PADRAO
  const fluxosCalc = fluxos
    .slice()
    .sort((a, b) => (a.ordem ?? 99) - (b.ordem ?? 99))
    .map((f) => calcularFluxo(f, parcelas, imovel, indices, media, mesesRef))

  const todas = fluxosCalc.flatMap((f) => f.parcelas)
  const totalPago = todas.filter((p) => p.parcela.pago).reduce((s, p) => s + p.valorCorrigido, 0)
  const totalRestante = todas
    .filter((p) => !p.parcela.pago)
    .reduce((s, p) => s + p.valorCorrigido, 0)
  const totalParcelas = todas.length
  const parcelasPagas = todas.filter((p) => p.parcela.pago).length
  const proxima = todas
    .filter((p) => !p.parcela.pago)
    .sort((a, b) => a.parcela.vencimento.localeCompare(b.parcela.vencimento))[0]

  return {
    imovel,
    fluxos: fluxosCalc,
    totalPago,
    totalRestante,
    saldoCorrigido: totalRestante,
    totalContrato: totalPago + totalRestante,
    totalParcelas,
    parcelasPagas,
    proxima,
    estimado: fluxosCalc.some((f) => f.estimado),
  }
}

/** Formata "2027-01" como "jan/2027" */
export const rotuloMes = (mes: string): string => {
  const [y, m] = mes.split('-').map(Number)
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${nomes[(m || 1) - 1]}/${y}`
}
