import type { Cartao } from '@/types/financial'

/**
 * Ajuste PONTUAL de fechamento do cartão, vale só para UM mês (o ajuste é
 * gravado como data completa no campo `fechamento_ajustado` do cartão e o
 * usuário reverte quando o mês passa — a tela mostra o aviso enquanto o mês
 * ajustado for o corrente).
 *
 * Ajustes de meses ANTERIORES são automaticamente ignorados no cálculo da
 * fatura (função `ajusteVigente`), mesmo que o campo ainda esteja gravado:
 * nenhum dado retroativo muda.
 */

/** "YYYY-MM" de um Date, no fuso local. */
export const mesDe = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

/**
 * O ajuste gravado no cartão vale para o mês informado? Devolve a data de
 * fechamento ajustada (Date) quando sim, null quando não há ajuste ou quando
 * ele é de outro mês (passado ou futuro).
 */
export const ajusteVigente = (cartao: Cartao, mes: string): Date | null => {
  if (!cartao.fechamento_ajustado) return null
  const d = new Date(cartao.fechamento_ajustado)
  if (Number.isNaN(d.getTime())) return null
  return mesDe(d) === mes ? d : null
}

/** Alias usado pela tela de Cartões para ler o ajuste do mês. */
export const ajusteFechamentoDoMes = ajusteVigente

/**
 * Grava (dia !== null) ou reverte (dia === null) o ajuste de fechamento do
 * cartão para o mês informado ("YYYY-MM"). A data gravada é o próprio dia do
 * mês informado, ex.: ajuste dia 8 em 2026-06 → "2026-06-08".
 */
export const salvarAjusteFechamento = async (
  cartao: Cartao,
  mes: string,
  dia: number | null,
): Promise<void> => {
  const { cartoesService } = await import('@/services/cartoes')
  await cartoesService.update(cartao.id, {
    fechamento_ajustado: dia === null ? null : `${mes}-${String(dia).padStart(2, '0')}`,
  })
}
