import React, { useState, useEffect } from 'react'
import { AppHeader } from '@/components/AppHeader'
import { BottomNav } from '@/components/BottomNav'
import { DonutChart, type DonutSlice } from '@/components/DonutChart'
import { CategoryDetail } from '@/components/CategoryDetail'
import { cartoesService } from '@/services/cartoes'
import { transacoesService, mesDaFatura } from '@/services/transacoes'
import type { Cartao, Transacao } from '@/types/financial'
import { ChevronLeft, ChevronRight, Trash2, Pencil, Eye, Plus, Lock, Sparkles } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { formatBRLPublic } from '@/lib/format'
import { useAuth } from '@/context/AuthContext'
import { Link, useNavigate } from 'react-router-dom'
import './extract.css'

/**
 * Tela de Extrato — portada 1:1 do views/extract do projeto original
 * (prj-finanzze-front, Angular): card "Entradas do mês" e card "Saídas do mês"
 * com os totais em azul, o rodapé de navegação de mês e o donut
 * "Gastos por Categoria" (mesmo dashboard-chart da Home aprovada na 0.0.8).
 * Nas saídas, cada despesa sem cartão tem sua própria linha e as despesas de
 * cartão do mês somam em uma única linha "Cartão de Crédito" com o olho, que
 * leva à aba Cartões (gasto por cartão).
 */
export const ExtractPage: React.FC = () => {
  const { canAccessFutureExtract } = useAuth()
  const navigate = useNavigate()

  // Mês selecionado (deslocamento em relação ao mês atual: 0 = atual, +1 = próximo)
  const [monthOffset, setMonthOffset] = useState<number>(0)
  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [loading, setLoading] = useState(true)
  const [cartoes, setCartoes] = useState<Cartao[]>([])

  // Detalhe de categoria aberto a partir do donut
  const [catDetalhe, setCatDetalhe] = useState<string | null>(null)
  const detailRef = React.useRef<HTMLDivElement | null>(null)

  // Ao selecionar fatia/categoria no donut, rola até a lista de gastos dela
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

  const isFutureMonth = monthOffset > 0
  const isLocked = isFutureMonth && !canAccessFutureExtract

  const loadMonth = async () => {
    if (isLocked) {
      setTransacoes([])
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const list = await transacoesService.list({ mes: monthStr })
      setTransacoes(list)
      setCartoes(await cartoesService.list())
    } catch (err) {
      console.error('Erro ao carregar extrato:', err)
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
  }, [monthOffset, isLocked])

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta transação?')) return
    try {
      await transacoesService.delete(id)
      setTransacoes((prev) => prev.filter((t) => t.id !== id))
      toast({
        title: 'Transação excluída',
        description: 'A movimentação e o saldo foram atualizados.',
      })
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir a transação.',
      })
    }
  }

  const receitas = transacoes.filter((t) => t.tipo === 'receita')
  const despesas = transacoes.filter((t) => t.tipo === 'despesa')
  const despesasCartao = despesas.filter((t) => t.cartao_id)
  const despesasSemCartao = despesas.filter((t) => !t.cartao_id)
  const totalCartoes = despesasCartao.reduce((acc, t) => acc + t.valor, 0)

  const totalReceitas = receitas.reduce((acc, t) => acc + t.valor, 0)
  const totalDespesas = despesas.reduce((acc, t) => acc + t.valor, 0)

  // Nome do cartão da linha consolidada. Com um único cartão, usa o nome dele
  // ("Cartão de Crédito" do print); com vários, entra a contagem de lançamentos.
  const nomeCartaoConsolidado = cartoes.length === 1 ? cartoes[0].nome : 'Cartão de Crédito'
  const multiCartao = cartoes.length > 1

  // Agrupamento por categoria das despesas (para o donut)
  const catMap = new Map<string, { nome: string; cor: string; valor: number }>()
  despesas.forEach((t) => {
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

  const donutData: DonutSlice[] = Array.from(catMap.entries())
    .filter(([, c]) => c.valor > 0)
    .sort((a, b) => b[1].valor - a[1].valor)
    .map(([id, c]) => ({ id, label: c.nome, value: c.valor, color: c.cor }))

  // "Economia" é a categoria padrão que não se lança: é a diferença
  // entradas − saídas do mês, exibida no gráfico como no original.
  const economia = totalReceitas - totalDespesas
  if (economia > 0) {
    donutData.push({ id: '__economia__', label: 'Economia', color: '#4C1D95', value: economia })
    donutData.sort((a, b) => b.value - a.value)
  }

  const catSelecionada = donutData.find((c) => c.id === catDetalhe) || null
  const gastosCatSelecionada = catSelecionada
    ? despesas.filter((t) => (t.categoria_id || 'outros') === catSelecionada.id)
    : []

  return (
    <div className="min-h-screen bg-[#F6F3FB] text-[#1F1438] finz-extract">
      <AppHeader />

      <main className="finz-extract-main">
        {/* Bloqueio de Meses Futuros para Plano FREE */}
        {isLocked ? (
          <FutureLock />
        ) : (
          <div className="finz-extract-container">
            {/* Card de Entradas do mês */}
            <div className="finz-extract-item finz-card-revenues">
              <div className="finz-extract-header">
                <h2>Entradas do mês</h2>
                <button
                  type="button"
                  className="finz-icon-btn-add"
                  aria-label="Adicionar entrada"
                  onClick={() => navigate('/nova-transacao', { state: { from: '/extrato' } })}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {receitas.length === 0 ? (
                <EmptyHint text="Nada registrado neste mês." />
              ) : (
                receitas.map((t) => (
                  <div key={t.id} className="finz-extract-row finz-row-revenue">
                    <h2 className="finz-row-name">{t.descricao}</h2>
                    <p className="finz-row-amount">+ {formatBRLPublic(t.valor)}</p>
                    <div className="finz-row-actions">
                      <button
                        type="button"
                        className="finz-icon-btn finz-danger"
                        aria-label={`Remover ${t.descricao}`}
                        title="Excluir lançamento"
                        onClick={() => handleDelete(t.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}

              <div className="finz-balance">
                <h2>Total</h2>
                <p>{formatBRLPublic(totalReceitas)}</p>
              </div>
            </div>

            {/* Card de Saídas do mês */}
            <div className="finz-extract-item finz-card-expenses">
              <div className="finz-extract-header">
                <h2>Saídas do mês</h2>
                <button
                  type="button"
                  className="finz-icon-btn-add"
                  aria-label="Adicionar saída"
                  onClick={() => navigate('/nova-transacao', { state: { from: '/extrato' } })}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {despesasSemCartao.length === 0 && despesasCartao.length === 0 ? (
                <EmptyHint text="Nada registrado neste mês." />
              ) : (
                <>
                  {despesasSemCartao.map((t) => (
                    <div key={t.id} className="finz-extract-row finz-row-expense">
                      <h2 className="finz-row-name">{t.descricao}</h2>
                      <p className="finz-row-amount">− {formatBRLPublic(t.valor)}</p>
                      <div className="finz-row-actions">
                        <button
                          type="button"
                          className="finz-icon-btn finz-danger"
                          aria-label={`Remover ${t.descricao}`}
                          title="Excluir lançamento"
                          onClick={() => handleDelete(t.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className="finz-icon-btn finz-primary-hover"
                          aria-label={`Editar ${t.descricao}`}
                          title="Editar lançamento"
                          onClick={() =>
                            navigate('/nova-transacao', { state: { from: '/extrato' } })
                          }
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {despesasCartao.length > 0 && (
                    <div className="finz-extract-row finz-row-expense">
                      <h2 className="finz-row-name">
                        {nomeCartaoConsolidado}
                        {multiCartao && (
                          <span className="finz-row-count">
                            {' '}
                            ({despesasCartao.length}{' '}
                            {despesasCartao.length === 1 ? 'lançamento' : 'lançamentos'})
                          </span>
                        )}
                      </h2>
                      <p className="finz-row-amount">− {formatBRLPublic(totalCartoes)}</p>
                      <div className="finz-row-actions">
                        <button
                          type="button"
                          className="finz-icon-btn finz-primary-hover"
                          aria-label="Ver extrato do cartão"
                          title="Ver gasto por cartão"
                          onClick={() => navigate('/cartoes')}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="finz-balance">
                <h2>Total</h2>
                <p>{formatBRLPublic(totalDespesas)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Gráfico — Gastos por Categoria (igual ao da Home 0.0.8) */}
        <section className="finz-extract-container finz-chart">
          <h1 className="finz-chart-title">Gastos por Categoria</h1>
          {loading ? (
            <div className="finz-loading">
              <span className="finz-spinner" />
            </div>
          ) : donutData.length === 0 ? (
            <div className="finz-empty">Nenhuma despesa registrada neste mês.</div>
          ) : (
            <div className="finz-chart-item">
              <DonutChart
                centerLabel="Total"
                centerValue={totalReceitas}
                slices={donutData}
                onSelectSlice={(id) => setCatDetalhe(catDetalhe === id ? null : id)}
                selectedId={catDetalhe}
              />
            </div>
          )}
        </section>

        {/* Detalhe da categoria selecionada no gráfico */}
        {catSelecionada && (
          <div ref={detailRef} className="finz-extract-container finz-detail">
            <CategoryDetail
              nome={catSelecionada.label}
              cor={catSelecionada.color}
              valor={catSelecionada.value}
              total={totalReceitas}
              itens={gastosCatSelecionada}
              onClose={() => setCatDetalhe(null)}
            />
          </div>
        )}
      </main>

      {/* Rodapé de navegação de mês — faixa branca horizontal do original */}
      <footer className="finz-month-footer" aria-label="Seletor de mês">
        <div className="finz-footer-inner">
          <button
            type="button"
            onClick={() => setMonthOffset((m) => m - 1)}
            aria-label="Mês anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span>{monthLabel}</span>
          <button
            type="button"
            onClick={() => setMonthOffset((m) => m + 1)}
            aria-label="Próximo mês"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </footer>

      <BottomNav />
    </div>
  )
}

const EmptyHint: React.FC<{ text: string }> = ({ text }) => <div className="finz-empty">{text}</div>

const FutureLock: React.FC = () => (
  <div className="bg-white rounded-3xl p-8 text-center border border-purple-200 shadow-md mt-4">
    <div className="w-14 h-14 rounded-full bg-purple-100 text-[#6639A6] flex items-center justify-center mx-auto mb-3">
      <Lock className="w-7 h-7" />
    </div>
    <h3 className="text-base font-black text-[#1F1438]">Extrato de Meses Futuros é Exclusivo</h3>
    <p className="text-xs text-gray-600 mt-1 max-w-xs mx-auto">
      No plano <strong>Free</strong> você visualiza apenas os meses correntes e passados. Atualize
      para o <strong>VIP</strong> ou <strong>Premium</strong> para desbloquear a previsão dos
      próximos meses!
    </p>
    <Link
      to="/planos"
      className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#4A247A] to-[#6639A6] text-white text-xs font-bold shadow-md hover:opacity-95 transition"
    >
      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
      Conhecer Planos VIP e Premium
    </Link>
  </div>
)
