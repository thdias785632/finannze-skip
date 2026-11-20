import React, { useState, useEffect } from 'react'
import { AppHeader } from '@/components/AppHeader'
import { BottomNav } from '@/components/BottomNav'
import { DonutChart, type DonutSlice } from '@/components/DonutChart'
import { cartoesService } from '@/services/cartoes'
import { transacoesService } from '@/services/transacoes'
import type { Cartao, Transacao } from '@/types/financial'
import { ChevronLeft, ChevronRight, Trash2, Pencil, Eye, Plus, Lock, Sparkles } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { formatBRLPublic } from '@/lib/format'
import { useAuth } from '@/context/AuthContext'
import { Link, useNavigate } from 'react-router-dom'

/**
 * Tela de Extrato — espelho da tela do app original:
 * um gráfico "Gastos por Categoria" (donut) no topo, seguido dos cards
 * "Entradas do mês" e "Saídas do mês". Nas saídas, cada despesa sem cartão
 * tem sua própria linha e TODAS as despesas de cartão do mês somam em uma
 * única linha "Cartões" — o olho leva à aba Cartões (gasto por cartão).
 */
export const ExtractPage: React.FC = () => {
  const { canAccessFutureExtract } = useAuth()

  // Mês selecionado (deslocamento em relação ao mês atual: 0 = atual, +1 = próximo)
  const [monthOffset, setMonthOffset] = useState<number>(0)
  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [loading, setLoading] = useState(true)
  const [cartoes, setCartoes] = useState<Cartao[]>([])

  // Detalhe de categoria aberto a partir do donut
  const [catDetalhe, setCatDetalhe] = useState<string | null>(null)

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

  const totalReceitasAcum = receitas.reduce((acc, t) => acc + t.valor, 0)

  const donutData: DonutSlice[] = Array.from(catMap.entries())
    .filter(([, c]) => c.valor > 0)
    .sort((a, b) => b[1].valor - a[1].valor)
    .map(([id, c]) => ({ id, label: c.nome, value: c.valor, color: c.cor }))

  // "Economia" é a categoria padrão que não se lança: é a diferença
  // entradas − saídas do mês, exibida no gráfico como no original.
  const economia = totalReceitasAcum - totalDespesas
  if (economia > 0) {
    donutData.push({ id: '__economia__', label: 'Economia', value: economia, color: '#4C1D95' })
    donutData.sort((a, b) => b.value - a.value)
  }

  const catSelecionada = donutData.find((c) => c.id === catDetalhe) || null
  const gastosCatSelecionada = catSelecionada
    ? despesas.filter((t) => (t.categoria_id || 'outros') === catSelecionada.id)
    : []

  return (
    <div className="min-h-screen bg-[#F6F3FB] text-[#1F1438] pb-24">
      <AppHeader />

      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">
        {/* Bloqueio de Meses Futuros para Plano FREE */}
        {isLocked ? (
          <FutureLock />
        ) : (
          <>
            {/* Gráfico de Gastos por Categoria (igual ao da Home) */}
            <section className="bg-white rounded-3xl p-5 shadow-[0_4px_24px_rgba(102,57,166,0.06)] border border-[#EBE4F5]">
              <h2 className="text-base font-black text-[#1F1438] mb-2">Gastos por Categoria</h2>
              {loading ? (
                <LoadingBox />
              ) : donutData.length === 0 ? (
                <EmptyHint text="Nenhuma despesa registrada neste mês." />
              ) : (
                <DonutChart
                  centerLabel="Total"
                  centerValue={totalDespesas}
                  slices={donutData}
                  onSelectSlice={(id) => setCatDetalhe(catDetalhe === id ? null : id)}
                  selectedId={catDetalhe}
                />
              )}
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

            {/* Card de Entradas do mês */}
            <MonthEntriesCard
              title="Entradas do mês"
              titleClass="text-[#1F1438]"
              itens={receitas}
              total={totalReceitas}
              onDelete={handleDelete}
              onCreate={() => setMonthOffset(monthOffset)}
            />

            {/* Card de Saídas do mês */}
            <MonthEntriesCard
              title="Saídas do mês"
              titleClass="text-[#6639A6]"
              itens={despesasSemCartao}
              total={totalDespesas}
              onDelete={handleDelete}
              onCreate={() => setMonthOffset(monthOffset)}
              cartoes={cartoes}
              totalCartoes={totalCartoes}
              qtdeLancamentosCartao={despesasCartao.length}
            />
          </>
        )}
      </main>

      {/* Rodapé de navegação de mês */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E5DEEE] py-2 shadow-[0_-4px_20px_rgba(102,57,166,0.06)]">
        <div className="max-w-md mx-auto flex items-center justify-between px-4">
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
        </div>
      </footer>
      <BottomNav />
    </div>
  )
}

const LoadingBox: React.FC = () => (
  <div className="py-12 text-center text-xs text-gray-400">
    <span className="inline-block w-5 h-5 border-2 border-[#6639A6] border-t-transparent rounded-full animate-spin" />
  </div>
)

const EmptyHint: React.FC<{ text: string }> = ({ text }) => (
  <div className="py-8 text-center text-xs text-gray-400">{text}</div>
)

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

interface MonthEntriesCardProps {
  title: string
  titleClass: string
  itens: Transacao[]
  total: number
  onDelete: (id: string) => void
  onCreate?: () => void
  cartoes?: Cartao[]
  totalCartoes?: number
  qtdeLancamentosCartao?: number
}

const MonthEntriesCard: React.FC<MonthEntriesCardProps> = ({
  title,
  titleClass,
  itens,
  total,
  onDelete,
  cartoes,
  totalCartoes = 0,
  qtdeLancamentosCartao = 0,
}) => {
  const navigate = useNavigate()
  const temConsolidadoCartoes = cartoes !== undefined
  return (
    <section className="bg-white rounded-3xl p-5 shadow-[0_4px_24px_rgba(102,57,166,0.06)] border border-[#EBE4F5]">
      <div className="flex items-center justify-between mb-2">
        <h3 className={`text-sm font-black ${titleClass}`}>{title}</h3>
        <button
          type="button"
          onClick={() => navigate('/nova-transacao')}
          className="w-8 h-8 rounded-full bg-[#F1EAF9] text-[#6639A6] flex items-center justify-center hover:bg-[#E3D5F5] transition"
          aria-label={`Adicionar ${title}`}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {temConsolidadoCartoes ? (
        /* Saídas: linha por despesa sem cartão + UMA linha consolidada de cartões */
        <>
          {itens.length === 0 && qtdeLancamentosCartao === 0 ? (
            <EmptyHint text="Nada registrado neste mês." />
          ) : (
            <div className="divide-y divide-gray-100">
              {itens.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-3">
                  <span className="text-xs font-semibold text-[#1F1438] truncate min-w-0">
                    {t.descricao}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-black tabular-nums text-rose-600">
                      − {formatBRLPublic(t.valor)}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate('/nova-transacao')}
                      className="p-1 text-gray-400 hover:text-[#6639A6] transition"
                      title="Editar lançamento"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(t.id)}
                      className="p-1 text-gray-400 hover:text-red-500 transition"
                      title="Excluir lançamento"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {qtdeLancamentosCartao > 0 && (
                <div className="flex items-center justify-between py-3">
                  <span className="text-xs font-semibold text-[#1F1438]">
                    Cartões ({qtdeLancamentosCartao}{' '}
                    {qtdeLancamentosCartao === 1 ? 'lançamento' : 'lançamentos'})
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-black tabular-nums text-rose-600">
                      − {formatBRLPublic(totalCartoes)}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate('/cartoes')}
                      className="p-1 text-gray-400 hover:text-[#6639A6] transition"
                      title="Ver gasto por cartão"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : /* Entradas: uma linha por lançamento */
      itens.length === 0 ? (
        <EmptyHint text="Nada registrado neste mês." />
      ) : (
        <div className="divide-y divide-gray-100">
          {itens.map((t) => (
            <div key={t.id} className="flex items-center justify-between py-3">
              <span className="text-xs font-semibold text-[#1F1438] truncate min-w-0">
                {t.descricao}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-black tabular-nums text-emerald-600">
                  + {formatBRLPublic(t.valor)}
                </span>
                <button
                  type="button"
                  onClick={() => navigate('/nova-transacao')}
                  className="p-1 text-gray-400 hover:text-[#6639A6] transition"
                  title="Editar lançamento"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(t.id)}
                  className="p-1 text-gray-400 hover:text-red-500 transition"
                  title="Excluir lançamento"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="pt-3 mt-1 border-t border-gray-100">
        <span className="text-[11px] text-gray-500 font-semibold">Total</span>
        <p className="text-sm font-black text-[#1D4ED8]">{formatBRLPublic(total)}</p>
      </div>
    </section>
  )
}

interface CategoryDetailProps {
  nome: string
  cor: string
  valor: number
  total: number
  itens: Transacao[]
  onClose: () => void
}

const CategoryDetail: React.FC<CategoryDetailProps> = ({
  nome,
  cor,
  valor,
  total,
  itens,
  onClose,
}) => {
  const pct = total > 0 ? ((valor / total) * 100).toFixed(1).replace('.', ',') : '0'
  return (
    <section className="bg-white rounded-3xl p-5 shadow-[0_4px_24px_rgba(102,57,166,0.06)] border border-[#EBE4F5]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cor }} />
          <h3 className="text-sm font-black text-[#1F1438] truncate">{nome}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-[11px] font-bold text-[#6639A6] hover:underline"
        >
          Fechar
        </button>
      </div>

      <p className="text-[11px] text-gray-500 mb-3">
        {pct}% dos gastos deste mês •{' '}
        <strong className="text-[#1F1438]">{formatBRLPublic(valor)}</strong>
      </p>

      {itens.length === 0 ? (
        <EmptyHint text="Nenhum gasto nesta categoria no mês." />
      ) : (
        <div className="divide-y divide-gray-100">
          {itens.map((t) => (
            <div key={t.id} className="flex items-center justify-between py-2.5">
              <span className="text-xs font-semibold text-[#1F1438] truncate min-w-0">
                {t.descricao}
              </span>
              <span className="text-xs font-black text-rose-600 tabular-nums shrink-0">
                − {formatBRLPublic(t.valor)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
