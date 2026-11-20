import type { DonutSlice } from '@/components/DonutChart'
import type { Transacao } from '@/types/financial'

export interface GastosPorCategoria {
  /** Fatias ordenadas (maior → menor). "Economia" vem primeiro quando positiva. */
  slices: DonutSlice[]
  /** Total do centro do gráfico: entradas quando há economia, senão o total de saídas. */
  total: number
  entradas: number
  saidas: number
  economia: number
}

const COR_ECONOMIA = '#1F1438'

/**
 * Agrupa as DESPESAS por categoria e acrescenta a fatia virtual "Economia"
 * (entradas − saídas), que não é lançada manualmente. Os percentuais do donut
 * ficam relativos ao total — igual ao app original, onde a soma das fatias é
 * a renda do mês quando sobra economia.
 */
export const computarGastosPorCategoria = (transacoes: Transacao[]): GastosPorCategoria => {
  let entradas = 0
  let saidas = 0

  const catMap = new Map<string, { id?: string; nome: string; cor: string; valor: number }>()

  transacoes.forEach((t) => {
    if (t.tipo === 'receita') {
      entradas += t.valor
      return
    }
    saidas += t.valor

    const catId = t.categoria_id || 'outros'
    const existing = catMap.get(catId)
    if (existing) {
      existing.valor += t.valor
    } else {
      catMap.set(catId, {
        id: t.categoria_id,
        nome: t.expand?.categoria_id?.nome || 'Outros',
        cor: t.expand?.categoria_id?.cor || '#A855F7',
        valor: t.valor,
      })
    }
  })

  const economia = entradas - saidas

  const slices: DonutSlice[] = Array.from(catMap.values())
    .filter((c) => c.valor > 0)
    .sort((a, b) => b.valor - a.valor)
    .map((c) => ({ id: c.id, label: c.nome, value: c.valor, color: c.cor }))

  // Economia só aparece quando positiva — ela é a diferença, nunca um lançamento
  if (economia > 0) {
    slices.unshift({ label: 'Economia', value: economia, color: COR_ECONOMIA })
  }

  return { slices, total: economia > 0 ? entradas : saidas, entradas, saidas, economia }
}
