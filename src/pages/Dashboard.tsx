import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AppHeader } from '@/components/AppHeader'
import { BottomNav } from '@/components/BottomNav'
import { DonutChart } from '@/components/DonutChart'
import { contasService } from '@/services/contas'
import { transacoesService } from '@/services/transacoes'
import { categoriasService } from '@/services/categorias'
import type { Conta, Transacao, Categoria } from '@/types/financial'
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  PlusCircle,
  Eye,
  EyeOff,
  Landmark,
  CreditCard,
  Building2,
  Calendar,
} from 'lucide-react'

export const DashboardPage: React.FC = () => {
  const [contas, setContas] = useState<Conta[]>([])
  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [showValues, setShowValues] = useState(true)

  // Mês atual formato "YYYY-MM"
  const now = new Date()
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthName = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  const loadData = async () => {
    try {
      setLoading(true)
      const [contasList, txList, catList] = await Promise.all([
        contasService.list(),
        transacoesService.list({ mes: currentMonthStr }),
        categoriasService.list(),
      ])
      setContas(contasList)
      setTransacoes(txList)
      setCategorias(catList)
    } catch (err) {
      console.error('Erro ao carregar dados do dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Cálculos do resumo
  const saldoTotal = contas.reduce((acc, c) => acc + (c.tipo === 'cartao' ? 0 : c.saldo), 0)
  const faturaCartao = contas
    .filter((c) => c.tipo === 'cartao')
    .reduce((acc, c) => acc + Math.abs(c.saldo), 0)

  const receitasMes = transacoes
    .filter((t) => t.tipo === 'receita')
    .reduce((acc, t) => acc + t.valor, 0)

  const despesasMes = transacoes
    .filter((t) => t.tipo === 'despesa')
    .reduce((acc, t) => acc + t.valor, 0)

  const resultadoMes = receitasMes - despesasMes

  // Agrupamento por categoria para o Donut
  const catMap = new Map<string, { nome: string; cor: string; valor: number }>()
  categorias.forEach((c) => catMap.set(c.id, { nome: c.nome, cor: c.cor, valor: 0 }))

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

  const donutData = Array.from(catMap.values())
    .filter((c) => c.valor > 0)
    .sort((a, b) => b.valor - a.valor)
    .map((c) => ({
      ...c,
      percentual: despesasMes > 0 ? (c.valor / despesasMes) * 100 : 0,
    }))

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
            <span className="font-medium tracking-wide">Saldo Total em Contas</span>
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
            {formatBRL(saldoTotal)}
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

        {/* Donut de Categorias Animado do Mês */}
        <section className="bg-white rounded-3xl p-5 shadow-[0_4px_24px_rgba(102,57,166,0.06)] border border-[#EBE4F5]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#6639A6]" />
              <h2 className="text-sm font-bold text-[#1F1438] capitalize">{monthName}</h2>
            </div>
            <Link
              to="/extrato"
              className="text-xs text-[#6639A6] font-bold hover:underline inline-flex items-center gap-0.5"
            >
              Extrato
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <DonutChart data={donutData} total={despesasMes} />
        </section>

        {/* Visão de Contas Rápidas */}
        <section className="bg-white rounded-3xl p-5 shadow-[0_4px_24px_rgba(102,57,166,0.06)] border border-[#EBE4F5]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Landmark className="w-4 h-4 text-[#6639A6]" />
              <h2 className="text-sm font-bold text-[#1F1438]">Minhas Contas</h2>
            </div>
            <Link
              to="/contas"
              className="text-xs text-[#6639A6] font-bold hover:underline inline-flex items-center gap-0.5"
            >
              Ver todas ({contas.length})
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-2">
            {contas.slice(0, 3).map((conta) => (
              <div
                key={conta.id}
                className="flex items-center justify-between p-2.5 rounded-2xl bg-[#FBF9FD] border border-[#EBE4F5] hover:bg-purple-50/50 transition"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-white"
                    style={{ backgroundColor: conta.cor || '#6639A6' }}
                  >
                    {conta.tipo === 'cartao' ? (
                      <CreditCard className="w-4 h-4" />
                    ) : conta.tipo === 'carteira' ? (
                      <Wallet className="w-4 h-4" />
                    ) : (
                      <Landmark className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-900 leading-tight">{conta.nome}</p>
                    <p className="text-[10px] text-gray-500 capitalize">{conta.tipo}</p>
                  </div>
                </div>

                <div className="text-right">
                  <p
                    className={`text-xs font-bold ${
                      conta.saldo < 0 ? 'text-rose-600' : 'text-gray-900'
                    }`}
                  >
                    {formatBRL(conta.saldo)}
                  </p>
                </div>
              </div>
            ))}

            {contas.length === 0 && !loading && (
              <div className="text-center py-4 text-xs text-gray-400">
                Nenhuma conta cadastrada ainda.
              </div>
            )}
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
