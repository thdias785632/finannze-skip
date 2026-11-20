import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AppHeader } from '@/components/AppHeader'
import { BottomNav } from '@/components/BottomNav'
import { DonutChart, type DonutSlice } from '@/components/DonutChart'
import { transacoesService } from '@/services/transacoes'
import type { Transacao } from '@/types/financial'
import { TrendingUp, TrendingDown, ChevronRight, Eye, EyeOff, CreditCard } from 'lucide-react'

export const DashboardPage: React.FC = () => {
  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [loading, setLoading] = useState(true)
  const [showValues, setShowValues] = useState(true)

  // Mês atual formato "YYYY-MM" (mês de fatura: a Home usa a mesma regra do extrato)
  const now = new Date()
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthName = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  const loadData = async () => {
    try {
      setLoading(true)
      // `list({ mes })` já aplica a regra do vencimento (fatura do mês seguinte)
      const txList = await transacoesService.list({ mes: currentMonthStr })
      setTransacoes(txList)
    } catch (err) {
      console.error('Erro ao carregar dados do dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Cálculos do resumo — Saldo do mês = receitas - despesas da fatura atual
  const receitasMes = transacoes
    .filter((t) => t.tipo === 'receita')
    .reduce((acc, t) => acc + t.valor, 0)

  const despesasMes = transacoes
    .filter((t) => t.tipo === 'despesa')
    .reduce((acc, t) => acc + t.valor, 0)

  const saldoDoMes = receitasMes - despesasMes

  // Agrupamento por categoria para o Donut
  const catMap = new Map<string, { nome: string; cor: string; valor: number }>()

  transacoes
    .filter((t) => t.tipo === 'despesa')
    .forEach((t) => {
      const catId = t.categoria_id || 'outros'
      const existing = catMap.get(catId)
      if (existing) {
        existing.valor += t.valor
      } else {
        catMap.set(catId, {
          nome: t.expand?.categoria_id?.nome || 'Outros',
          cor: t.expand?.categoria_id?.cor || '#A855F7',
          valor: t.valor,
        })
      }
    })

  const donutData: DonutSlice[] = Array.from(catMap.values())
    .filter((c) => c.valor > 0)
    .sort((a, b) => b.valor - a.valor)
    .map((c) => ({ label: c.nome, value: c.valor, color: c.cor }))

  const formatBRL = (val: number) => {
    if (!showValues) return '••••••'
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  }

  return (
    <div className="min-h-screen bg-[#F6F3FB] text-[#1F1438] pb-24">
      <AppHeader />

      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">
        {/* Bloco de Saldo em Destaque (Topo) */}
        <section className="bg-gradient-to-br from-[#4A247A] via-[#6639A6] to-[#7A45BF] text-white rounded-3xl p-5 shadow-[0_12px_32px_rgba(102,57,166,0.22)] relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-44 h-44 bg-white/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-center justify-between text-white/80 text-xs mb-1.5">
            <span className="font-medium tracking-wide capitalize">Saldo do mês</span>
            <button
              type="button"
              onClick={() => setShowValues(!showValues)}
              className="p-1 rounded-full hover:bg-white/10 transition text-white/90"
              aria-label={showValues ? 'Ocultar saldo' : 'Mostrar saldo'}
            >
              {showValues ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div className="text-3xl font-black tracking-tight mb-4 text-white">
            {formatBRL(saldoDoMes)}
          </div>

          {/* Cards de Resumo Receitas / Despesas */}
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/15">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5">
              <div className="flex items-center gap-1.5 text-emerald-300 text-[11px] font-semibold mb-0.5">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Receitas (Mês)</span>
              </div>
              <div className="text-sm font-bold text-white">{formatBRL(receitasMes)}</div>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5">
              <div className="flex items-center gap-1.5 text-rose-300 text-[11px] font-semibold mb-0.5">
                <TrendingDown className="w-3.5 h-3.5" />
                <span>Despesas (Mês)</span>
              </div>
              <div className="text-sm font-bold text-white">{formatBRL(despesasMes)}</div>
            </div>
          </div>
        </section>

        {/* Donut de Categorias — igual ao do projeto original */}
        <section className="bg-white rounded-3xl p-5 shadow-[0_4px_24px_rgba(102,57,166,0.06)] border border-[#EBE4F5]">
          <h2 className="text-base font-black text-[#1F1438] mb-2">Gastos por categoria</h2>

          <DonutChart centerLabel="Renda" centerValue={receitasMes} slices={donutData} />
        </section>

        {/* Atalho para Cartões */}
        <section className="bg-white rounded-3xl p-5 shadow-[0_4px_24px_rgba(102,57,166,0.06)] border border-[#EBE4F5]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#6639A6]/10 text-[#6639A6]">
                <CreditCard className="w-4.5 h-4.5" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-900 leading-tight">Meus Cartões</p>
                <p className="text-[10px] text-gray-500">Gerencie os vencimentos das faturas</p>
              </div>
            </div>
            <Link
              to="/cartoes"
              className="text-xs text-[#6639A6] font-bold hover:underline inline-flex items-center gap-0.5"
            >
              Ver cartões
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </section>

        {/* Últimas Transações */}
        <section className="bg-white rounded-3xl p-5 shadow-[0_4px_24px_rgba(102,57,166,0.06)] border border-[#EBE4F5]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-[#1F1438]">Últimas Movimentações</h2>
            <Link
              to="/extrato"
              className="text-xs text-[#6639A6] font-bold hover:underline inline-flex items-center gap-0.5"
            >
              Ver todas
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-2">
            {transacoes.slice(0, 5).map((t) => {
              const dateObj = new Date(t.data)
              const formattedDate = dateObj.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
              })
              return (
                <div
                  key={t.id}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-none"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: (t.expand?.categoria_id?.cor || '#6639A6') + '20',
                        color: t.expand?.categoria_id?.cor || '#6639A6',
                      }}
                    >
                      {t.tipo === 'receita' ? (
                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-rose-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900 leading-tight">{t.descricao}</p>
                      <p className="text-[10px] text-gray-500">
                        {t.expand?.categoria_id?.nome || 'Geral'} • {formattedDate}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-xs font-bold ${
                      t.tipo === 'receita' ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {t.tipo === 'receita' ? '+' : '-'} {formatBRL(t.valor)}
                  </span>
                </div>
              )
            })}

            {transacoes.length === 0 && !loading && (
              <div className="text-center py-6 text-xs text-gray-400">
                Nenhuma movimentação neste mês.
              </div>
            )}
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  )
}
