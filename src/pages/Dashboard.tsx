import React, { useState, useEffect, useMemo } from 'react'
import { AppHeader } from '@/components/AppHeader'
import { BottomNav } from '@/components/BottomNav'
import { DonutChart, type DonutSlice } from '@/components/DonutChart'
import { transacoesService } from '@/services/transacoes'
import type { Transacao } from '@/types/financial'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { formatBRLPublic } from '@/lib/format'
import { CategoryDetail } from '@/components/CategoryDetail'

/**
 * Tela de Resumo (Home) — gráfico "Gastos por Categoria" com centro "Total",
 * fatias/legenda clicáveis (abrem os gastos da categoria) e a categoria
 * padrão "Economia" (diferença entradas − saídas do mês).
 */
export const DashboardPage: React.FC = () => {
  const [monthOffset, setMonthOffset] = useState<number>(0)
  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [loading, setLoading] = useState(true)
  const [catDetalhe, setCatDetalhe] = useState<string | null>(null)

  const targetDate = new Date()
  targetDate.setMonth(targetDate.getMonth() + monthOffset)
  const targetYear = targetDate.getFullYear()
  const targetMonthNum = targetDate.getMonth() + 1
  const monthStr = `${targetYear}-${String(targetMonthNum).padStart(2, '0')}`
  const monthLabel = targetDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  const loadMonth = async () => {
    try {
      setLoading(true)
      const list = await transacoesService.list({ mes: monthStr })
      setTransacoes(list)
    } catch (err) {
      console.error('Erro ao carregar resumo:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar as movimentações do mês.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMonth()
  }, [monthOffset])

  const receitas = transacoes.filter((t) => t.tipo === 'receita')
  const despesas = transacoes.filter((t) => t.tipo === 'despesa')
  const totalReceitas = receitas.reduce((acc, t) => acc + t.valor, 0)
  const totalDespesas = despesas.reduce((acc, t) => acc + t.valor, 0)

  // Agrupa despesas por categoria e acrescenta a "Economia" (padrão,
  // não lançada manualmente) como a diferença entradas − saídas.
  const donutData: DonutSlice[] = useMemo(() => {
    const catMap = new Map<string, { nome: string; cor: string; valor: number }>()
    despesas.forEach((t) => {
      const catId = t.categoria_id || 'outros'
      const existing = catMap.get(catId)
      if (existing) existing.valor += t.valor
      else
        catMap.set(catId, {
          nome: t.expand?.categoria_id?.nome || 'Outros',
          cor: t.expand?.categoria_id?.cor || '#A855F7',
          valor: t.valor,
        })
    })

    const slices: DonutSlice[] = Array.from(catMap.entries())
      .filter(([, c]) => c.valor > 0)
      .sort((a, b) => b[1].valor - a[1].valor)
      .map(([id, c]) => ({ id, label: c.nome, value: c.valor, color: c.cor }))

    const economia = totalReceitas - totalDespesas
    if (economia > 0) {
      slices.push({ id: '__economia__', label: 'Economia', value: economia, color: '#4C1D95' })
      slices.sort((a, b) => b.value - a.value)
    }
    return slices
  }, [despesas, totalReceitas, totalDespesas])

  const catSelecionada = donutData.find((c) => c.id === catDetalhe) || null
  const gastosCatSelecionada = useMemo(() => {
    if (!catSelecionada) return []
    if (catSelecionada.id === '__economia__') return []
    return despesas.filter((t) => (t.categoria_id || 'outros') === catSelecionada.id)
  }, [catSelecionada, despesas])

  return (
    <div className="min-h-screen bg-[#F6F3FB] text-[#1F1438] pb-24">
      <AppHeader />

      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">
        {/* Navegação de meses no topo — layout da v0.0.3 */}
        <section className="bg-white rounded-3xl px-4 py-3 shadow-[0_4px_24px_rgba(102,57,166,0.06)] border border-[#EBE4F5] flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMonthOffset((m) => m - 1)}
            className="p-2 rounded-xl hover:bg-purple-50 text-[#6639A6] transition"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-bold capitalize text-[#1F1438]">{monthLabel}</span>
          <button
            type="button"
            onClick={() => setMonthOffset((m) => m + 1)}
            className="p-2 rounded-xl hover:bg-purple-50 text-[#6639A6] transition"
            aria-label="Próximo mês"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </section>

        <section className="bg-white rounded-3xl p-5 shadow-[0_4px_24px_rgba(102,57,166,0.06)] border border-[#EBE4F5]">
          <h2 className="text-base font-black text-[#1F1438] mb-2">Gastos por Categoria</h2>
          {loading ? (
            <div className="py-12 text-center text-xs text-gray-400">
              <span className="inline-block w-5 h-5 border-2 border-[#6639A6] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : donutData.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-400">
              Nenhuma movimentação registrada neste mês.
            </div>
          ) : (
            <DonutChart
              centerLabel="Total"
              centerValue={totalDespesas}
              slices={donutData}
              onSelectSlice={(id) => setCatDetalhe((prev) => (prev === id ? null : id))}
              selectedId={catDetalhe}
            />
          )}
        </section>

        {/* Resumo do mês (entradas/saídas) */}
        <section className="bg-white rounded-3xl p-5 shadow-[0_4px_24px_rgba(102,57,166,0.06)] border border-[#EBE4F5] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Entradas do mês</span>
            <span className="text-sm font-black text-emerald-600">
              + {formatBRLPublic(totalReceitas)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Saídas do mês</span>
            <span className="text-sm font-black text-rose-600">
              − {formatBRLPublic(totalDespesas)}
            </span>
          </div>
          <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Economia</span>
            <span
              className={`text-sm font-black ${totalReceitas - totalDespesas >= 0 ? 'text-[#1D4ED8]' : 'text-rose-600'}`}
            >
              {totalReceitas - totalDespesas >= 0 ? '+' : '−'}{' '}
              {formatBRLPublic(Math.abs(totalReceitas - totalDespesas))}
            </span>
          </div>
        </section>

        {/* Detalhe da categoria selecionada no gráfico */}
        {catSelecionada && (
          <CategoryDetail
            nome={catSelecionada.label}
            cor={catSelecionada.color}
            valor={catSelecionada.value}
            total={totalDespesas}
            itens={gastosCatSelecionada}
            onClose={() => setCatDetalhe(null)}
          />
        )}
      </main>

      <BottomNav />
    </div>
  )
}
