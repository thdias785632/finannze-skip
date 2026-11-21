import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { AppHeader } from '@/components/AppHeader'
import { BottomNav } from '@/components/BottomNav'
import { DonutChart, type DonutSlice } from '@/components/DonutChart'
import { transacoesService, mesDaFatura } from '@/services/transacoes'
import { cartoesService } from '@/services/cartoes'
import type { Cartao, Transacao } from '@/types/financial'
import type { User } from '@/types/financial'
import { useAuth } from '@/context/AuthContext'
import {
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ChevronRight as ChevronRightIcon,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { formatBRLPublic } from '@/lib/format'
import { CategoryDetail } from '@/components/CategoryDetail'
import './dashboard-home.css'

/** Primeiro nome do usuário, como no greeting do original ("Olá, THIAGO"). */
const firstNameOf = (user: { name?: string } | null | undefined): string =>
  (user?.name || '').trim().split(/\s+/)[0] || ''

/**
 * Tela de Início — portada do dashboard do projeto original
 * (prj-finanzze-front, Angular): resumo do mês (saldo, entradas e saídas),
 * seção de cartões com a fatura do mês e as últimas compras, e o donut de
 * gastos por categoria portado na 0.0.7. Mesmos textos, cores e hierarquia
 * do original, com os dados vindo das coleções PocketBase deste projeto
 * (regra de fatura por vencimento aplicada no transacoesService).
 */
export const DashboardPage: React.FC = () => {
  const { user } = useAuth()
  const [monthOffset, setMonthOffset] = useState<number>(0)
  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [cartoes, setCartoes] = useState<Cartao[]>([])
  const [loading, setLoading] = useState(true)
  const [catDetalhe, setCatDetalhe] = useState<string | null>(null)
  const detailRef = useRef<HTMLDivElement | null>(null)

  // Ao clicar numa fatia/categoria, rola até a lista de gastos da categoria
  useEffect(() => {
    if (catDetalhe && detailRef.current) {
      detailRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [catDetalhe])

  const targetDate = new Date()
  targetDate.setMonth(targetDate.getMonth() + monthOffset)
  const targetYear = targetDate.getFullYear()
  const targetMonthNum = targetDate.getMonth() + 1
  const monthStr = `${targetYear}-${String(targetMonthNum).padStart(2, '0')}`
  const monthLabel = targetDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  // Chip do card de resumo, como no original: "Nov 2026"
  const monthChip = targetDate
    .toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
    .replace('.', '')

  const loadMonth = useCallback(async () => {
    try {
      setLoading(true)
      const [list, cs] = await Promise.all([
        transacoesService.list({ mes: monthStr }),
        cartoesService.list(),
      ])
      setTransacoes(list)
      setCartoes(cs)
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
      // "Economia" é fatia calculada (entradas − saídas), não lançável.
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

  // Cartões: fatura do mês (mesma regra de vencimento usada no extrato)
  const cartoesComFatura = useMemo(() => {
    return cartoes.map((cartao) => {
      const doCartao = transacoes.filter((t) => t.tipo === 'despesa' && t.cartao_id === cartao.id)
      const faturaMes = doCartao.filter((t) => mesDaFatura(t, [cartao]) === monthStr)
      const totalFatura = faturaMes.reduce((acc, t) => acc + t.valor, 0)
      const ultimasCompras = [...doCartao]
        .sort((a, b) => (a.data < b.data ? 1 : -1))
        .slice(0, 3)
        .map((t) => ({ id: t.id, nome: t.descricao, valor: t.valor }))
      return { cartao, totalFatura, ultimasCompras }
    })
  }, [cartoes, transacoes, monthStr])

  const firstName = firstNameOf(user)

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

        {/* Resumo do mês — card roxo com saldo, entradas e saídas (hero do original) */}
        <section className="finz-hero" aria-label="Resumo do mês">
          <div className="finz-hero-top">
            <span className="finz-hero-greeting">Olá{firstName ? `, ${firstName}` : ''}</span>
            <span className="finz-hero-month">{monthChip}</span>
          </div>

          <span className="finz-hero-caption">Saldo do mês</span>
          <p className={`finz-hero-balance${saldo < 0 ? ' is-negative' : ''}`}>
            {formatBRLPublic(saldo)}
          </p>

          <div className="finz-hero-stats">
            <div className="finz-stat">
              <span className="finz-stat-icon in">
                <ArrowUp className="w-3.5 h-3.5" />
              </span>
              <div className="finz-stat-text">
                <span className="finz-stat-label">Entradas</span>
                <span className="finz-stat-value in">{formatBRLPublic(totalReceitas)}</span>
              </div>
            </div>

            <div className="finz-stat">
              <span className="finz-stat-icon out">
                <ArrowDown className="w-3.5 h-3.5" />
              </span>
              <div className="finz-stat-text">
                <span className="finz-stat-label">Saídas</span>
                <span className="finz-stat-value out">{formatBRLPublic(totalDespesas)}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Cartões — cada cartão com a fatura do mês e as últimas compras */}
        {cartoesComFatura.length > 0 && (
          <section aria-label="Cartões">
            <div className="finz-cards-head">
              <h2>Cartões</h2>
              <Link to="/cartoes" className="finz-cards-more">
                Ver todos <ChevronRightIcon className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="finz-cards-grid">
              {cartoesComFatura.map(({ cartao, totalFatura, ultimasCompras }) => (
                <article key={cartao.id} className="finz-cc">
                  <div className="finz-cc-visual">
                    <div className="finz-cc-top">
                      <span className="finz-cc-chip" aria-hidden="true" />
                      <span className="finz-cc-flag">VISA</span>
                    </div>
                    <div className="finz-cc-body">
                      <span className="finz-cc-label">Fatura atual</span>
                      <span className="finz-cc-value">{formatBRLPublic(totalFatura)}</span>
                    </div>
                    <span className="finz-cc-name">{cartao.nome}</span>
                  </div>

                  <div className="finz-cc-recent">
                    <span className="finz-recent-title">Últimas compras</span>
                    {ultimasCompras.length > 0 ? (
                      <ul>
                        {ultimasCompras.map((c) => (
                          <li key={c.id}>
                            <span className="finz-recent-name">{c.nome}</span>
                            <span className="finz-recent-value">{formatBRLPublic(c.valor)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="finz-recent-empty">Sem compras neste mês.</p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

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
          <div ref={detailRef}>
            <CategoryDetail
              nome={catSelecionada.label}
              cor={catSelecionada.color}
              valor={catSelecionada.value}
              total={totalDespesas}
              itens={gastosCatSelecionada}
              onClose={() => setCatDetalhe(null)}
            />
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
