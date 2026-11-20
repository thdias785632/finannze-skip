import type { Imovel, ParcelaFluxo, FluxoImovel } from '@/types/financial'

/**
 * Cálculo de correção INCC para os fluxos de um imóvel.
 *
 * - Cada parcela usa o INCC do seu `mes_base` (vencimento − defasagem do imóvel).
 * - Índices já divulgados (série SGS 192 do Banco Central) são os valores reais.
 * - Índices ainda não divulgados são estimados pela MÉDIA do INCC do ano
 *   corrente — o valor mostrado é aproximado e isso é sinalizado na UI.
 */

export interface IndiceINCC {
  [mes: string]: number // "YYYY-MM" → variação % mensal
}

export interface ParcelaCalculada {
  parcela: ParcelaFluxo
  /** Índices aplicados (reais e estimados) até a parcela ficar corrigida. */
  fatores: { mes: string; variacao: number; estimado: boolean }[]
  /** fator de correção total aplicado (1.0 = sem correção) */
  fator: number
  /** valor base da parcela (sem correção) */
  valorBase: number
  /** valor corrigido (real quando todos os índices existem; estimado caso contrário) */
  valorCorrigido: number
  /** true quando algum índice ainda não foi divulgado (valor é estimativa) */
  estimado: boolean
  /** média mensal usada na estimativa, quando aplicável */
  mediaUsada?: number
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

/**
 * Média do INCC do ANO CORRENTE — usada como estimativa para índices
 * que o Banco Central ainda não divulgou.
 */
export const mediaInccAnoCorrente = (indices: IndiceINCC): number => {
  const ano = new Date().getFullYear()
  const vars: number[] = []
  for (let m = 1; m <= 12; m++) {
    const chave = `${ano}-${String(m).padStart(2, '0')}`
    if (indices[chave] != null) vars.push(indices[chave])
  }
  if (vars.length === 0) return 0
  return vars.reduce((a, b) => a + b, 0) / vars.length
}

/** Lista de meses entre `de` e `ate` (inclusivos), "YYYY-MM". */
const mesesEntre = (de: string, ate: string): string[] => {
  const lista: string[] = []
  let atual = de
  let guard = 0
  while (atual <= ate && guard < 1200) {
    lista.push(atual)
    const [y, m] = atual.split('-').map(Number)
    const d = new Date(y, m - 1 + 1, 1)
    atual = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    guard++
  }
  return lista
}

/**
 * Corrige um valor do `mesBase` até o mês em que a parcela fica "fechada"
 * (vencimento − defasagem), multiplicando os INCCs do período.
 * Índices inexistentes usam a média do ano corrente (estimativa).
 */
export const calcularParcela = (
  parcela: ParcelaFluxo,
  imovel: Imovel,
  indices: IndiceINCC,
  mediaAnoCorrente: number,
): ParcelaCalculada => {
  const defasagem = imovel.defasagem_incc ?? imovel.defasagem_meses ?? 2
  const venc = new Date(parcela.vencimento)
  const mesVenc = `${venc.getFullYear()}-${String(venc.getMonth() + 1).padStart(2, '0')}`
  // Mês em que a parcela é "fechada" (valor fixado), já com a defasagem aplicada
  const mesFechamento = mesAnterior(mesVenc, defasagem)

  // INCC é aplicado do mês base do contrato até o mês de fechamento
  const inicio = parcela.mes_base || imovel.mes_base_incc
  const fatores: ParcelaCalculada['fatores'] = []
  let fator = 1
  let estimado = false
  let somaEstimadas = 0
  let qtdeEstimadas = 0

  if (inicio && inicio <= mesFechamento) {
    for (const mes of mesesEntre(inicio, mesFechamento)) {
      const real = indices[mes]
      if (real != null) {
        fator *= 1 + real / 100
        fatores.push({ mes, variacao: real, estimado: false })
      } else {
        fator *= 1 + mediaAnoCorrente / 100
        fatores.push({ mes, variacao: mediaAnoCorrente, estimado: true })
        estimado = true
        somaEstimadas += mediaAnoCorrente
        qtdeEstimadas++
      }
    }
  }

  const valorBase = parcela.valor_base
  return {
    parcela,
    fatores,
    fator,
    valorBase,
    valorCorrigido: valorBase * fator,
    estimado,
    mediaUsada: qtdeEstimadas > 0 ? somaEstimadas / qtdeEstimadas : undefined,
  }
}

export const calcularFluxo = (
  fluxo: FluxoImovel,
  parcelas: ParcelaFluxo[],
  imovel: Imovel,
  indices: IndiceINCC,
  mediaAnoCorrente: number,
): FluxoCalculado => {
  const calculadas = parcelas
    .filter((p) => p.fluxo_id === fluxo.id)
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
    .map((p) => calcularParcela(p, imovel, indices, mediaAnoCorrente))

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
  const fluxosCalc = fluxos
    .slice()
    .sort((a, b) => (a.ordem ?? 99) - (b.ordem ?? 99))
    .map((f) => calcularFluxo(f, parcelas, imovel, indices, media))

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
