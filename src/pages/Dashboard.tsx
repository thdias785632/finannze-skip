import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { AppHeader } from '@/components/AppHeader'
import { BottomNav } from '@/components/BottomNav'
import { DonutChart, type DonutSlice } from '@/components/DonutChart'
import { transacoesService } from '@/services/transacoes'
import type { Transacao } from '@/types/financial'
import { useAuth } from '@/context/AuthContext'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { formatBRLPublic } from '@/lib/format'
import { CategoryDetail } from '@/components/CategoryDetail'

/**
 * Tela de Início — portada do dashboard-chart do projeto original
 * (prj-finanzze-front, Angular). Mesma estrutura do template, mesmos textos,
 * mesmo tema roxo e a lógica do TS original (agrupamento por categoria,
 * navegação de meses e a fatia "Economia" calculada), com os dados vindo
 * das coleções PocketBase deste projeto (regra de fatura por vencimento
 * aplicada no transacoesService).
 */
export const DashboardPage: React.FC = () => {
  const { user } = useAuth()
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

  const loadMonth = useCallback(async () => {
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
  }, [monthStr])

  useEffect(() => {
    void loadMonth()
  }, [loadMonth])

  const receitas = useMemo(() => transacoes.filter((t) => t.tipo === 'receita'), [transacoes])
  const despesas = useMemo(() => transacoes.filter((t) => t.tipo === 'despesa'), [transacoes])
  const totalReceitas = receitas.reduce((acc, t) => acc + t.valor, 0)
  const totalDespesas = despesas.reduce((acc, t) => acc + t.valor, 0)
  const saldo = totalReceitas - totalDespesas

  // Agrupa despesas por categoria (lógica do dashboard-chart original) e
  // acrescenta a "Economia" — categoria calculada, não lançável: entradas − saídas.
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

    if (saldo > 0) {
      slices.push({ id: '__economia__', label: 'Economia', value: saldo, color: '#4C1D95' })
      slices.sort((a, b) => b.value - a.value)
    }
    return slices
  }, [despesas, saldo])

  const catSelecionada = donutData.find((c) => c.id === catDetalhe) || null
  const gastosCatSelecionada = useMemo(() => {
    if (!catSelecionada) return []
    if (catSelecionada.id === '__economia__') return []
    return despesas.filter((t) => (t.categoria_id || 'outros') === catSelecionada.id)
  }, [catSelecionada, despesas])

  return (
    <div className="min-h-screen bg-[#F6F3FB] text-[#1F1438] pb-24 finz-dashboard">
      <AppHeader />

      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">
        {/* Navegação de meses — igual ao original */}
        <section className="finz-card finz-month-nav">
          <button
            type="button"
            onClick={() => setMonthOffset((m) => m - 1)}
            className="finz-month-arrow"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="finz-month-label">{monthLabel}</span>
          <button
            type="button"
            onClick={() => setMonthOffset((m) => m + 1)}
            className="finz-month-arrow"
            aria-label="Próximo mês"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </section>

        {/* Resumo do mês — Entradas / Saídas / Saldo, como no original */}
        <section className="finz-card finz-summary">
          <div className="finz-summary-row">
            <span className="finz-summary-label">Entradas do mês</span>
            <span className="finz-summary-value finz-in">+ {formatBRLPublic(totalReceitas)}</span>
          </div>
          <div className="finz-summary-row">
            <span className="finz-summary-label">Saídas do mês</span>
            <span className="finz-summary-value finz-out">− {formatBRLPublic(totalDespesas)}</span>
          </div>
          <div className="finz-summary-row finz-summary-total">
            <span className="finz-summary-label">
              {user?.name ? `Saldo de ${user.name.split(' ')[0]}` : 'Saldo do mês'}
            </span>
            <span className={`finz-summary-value ${saldo >= 0 ? 'finz-balance' : 'finz-out'}`}>
              {formatBRLPublic(saldo)}
            </span>
          </div>
        </section>

        {/* Gráfico — Gastos por Categoria (dashboard-chart) */}
        <section className="finz-card">
          <h2 className="finz-chart-title">Gastos por Categoria</h2>
          {loading ? (
            <div className="finz-loading">
              <span className="finz-spinner" />
            </div>
          ) : donutData.length === 0 ? (
            <div className="finz-empty">Nenhuma movimentação registrada neste mês.</div>
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

        {/* Detalhe da categoria selecionada no gráfico — igual ao original */}
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
