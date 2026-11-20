import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AppHeader } from '@/components/AppHeader'
import { BottomNav } from '@/components/BottomNav'
import { transacoesService, rotuloFatura } from '@/services/transacoes'
import { useAuth } from '@/context/AuthContext'
import type { Transacao } from '@/types/financial'
import {
  ChevronLeft,
  ChevronRight,
  Lock,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trash2,
  Calendar,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'

export const ExtractPage: React.FC = () => {
  const { plan, canAccessFutureExtract } = useAuth()

  // Mês selecionado no extrato (deslocamento em relação ao mês atual: 0 = atual, +1 = próximo, -1 = passado)
  const [monthOffset, setMonthOffset] = useState<number>(0)
  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [loading, setLoading] = useState(true)

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

  const totalReceitas = transacoes
    .filter((t) => t.tipo === 'receita')
    .reduce((acc, t) => acc + t.valor, 0)

  const totalDespesas = transacoes
    .filter((t) => t.tipo === 'despesa')
    .reduce((acc, t) => acc + t.valor, 0)

  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

  return (
    <div className="min-h-screen bg-[#F6F3FB] text-[#1F1438] pb-24">
      <AppHeader />

      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">
        {/* Navegador de Mês */}
        <div className="bg-white rounded-2xl p-3 shadow-xs border border-[#EBE4F5] flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMonthOffset((m) => m - 1)}
            className="p-2 rounded-xl hover:bg-purple-50 text-[#6639A6] transition"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex flex-col items-center">
            <span className="text-sm font-black capitalize text-[#1F1438]">{monthLabel}</span>
            {monthOffset === 0 && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6639A6]">
                {rotuloFatura(monthStr)}
              </span>
            )}
            {isFutureMonth && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 flex items-center gap-1">
                <Calendar className="w-2.5 h-2.5" />
                Mês Futuro (Previsão)
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMonthOffset((m) => m + 1)}
            className="p-2 rounded-xl hover:bg-purple-50 text-[#6639A6] transition"
            aria-label="Próximo mês"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Resumo do Mês */}
        {!isLocked && (
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-2xl p-3 border border-emerald-100 shadow-xs">
              <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" /> Receitas
              </span>
              <p className="text-sm font-black text-emerald-800 mt-0.5">
                {formatBRL(totalReceitas)}
              </p>
            </div>

            <div className="bg-white rounded-2xl p-3 border border-rose-100 shadow-xs">
              <span className="text-[11px] font-semibold text-rose-700 flex items-center gap-1">
                <TrendingDown className="w-3.5 h-3.5" /> Despesas
              </span>
              <p className="text-sm font-black text-rose-800 mt-0.5">{formatBRL(totalDespesas)}</p>
            </div>
          </div>
        )}

        {/* Bloqueio de Meses Futuros para Plano FREE */}
        {isLocked ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-purple-200 shadow-md">
            <div className="w-14 h-14 rounded-full bg-purple-100 text-[#6639A6] flex items-center justify-center mx-auto mb-3">
              <Lock className="w-7 h-7" />
            </div>
            <h3 className="text-base font-black text-[#1F1438]">
              Extrato de Meses Futuros é Exclusivo
            </h3>
            <p className="text-xs text-gray-600 mt-1 max-w-xs mx-auto">
              No plano <strong>Free</strong> você visualiza apenas os meses correntes e passados.
              Atualize para o <strong>VIP</strong> ou <strong>Premium</strong> para desbloquear a
              previsão dos próximos meses!
            </p>

            <Link
              to="/planos"
              className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#4A247A] to-[#6639A6] text-white text-xs font-bold shadow-md hover:opacity-95 transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              Conhecer Planos VIP e Premium
            </Link>
          </div>
        ) : (
          /* Lista de Movimentações */
          <div className="bg-white rounded-3xl p-4 shadow-[0_4px_24px_rgba(102,57,166,0.06)] border border-[#EBE4F5] space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                {transacoes.length} {transacoes.length === 1 ? 'Lançamento' : 'Lançamentos'}
              </span>
              <Link
                to="/nova-transacao"
                className="text-xs text-[#6639A6] font-bold hover:underline"
              >
                + Adicionar
              </Link>
            </div>

            {loading ? (
              <div className="py-12 text-center text-xs text-gray-400">
                <span className="inline-block w-5 h-5 border-2 border-[#6639A6] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : transacoes.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-400">
                Nenhuma movimentação registrada para este mês.
              </div>
            ) : (
              transacoes.map((t) => {
                const dateObj = new Date(t.data)
                const formattedDate = dateObj.toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                })

                return (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-2.5 rounded-2xl bg-[#FDFBFD] border border-gray-100 hover:border-purple-200 transition group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
                        style={{
                          backgroundColor: t.expand?.categoria_id?.cor || '#6639A6',
                        }}
                      >
                        {t.tipo === 'receita' ? (
                          <TrendingUp className="w-4 h-4 text-white" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-white" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-900 truncate">{t.descricao}</p>
                        <p className="text-[10px] text-gray-500">
                          {t.expand?.categoria_id?.nome || 'Geral'} • {formattedDate}
                          {t.recorrente && (
                            <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-purple-100 text-[#6639A6] text-[9px] font-bold">
                              Recorrente
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-xs font-black ${
                          t.tipo === 'receita' ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {t.tipo === 'receita' ? '+' : '-'} {formatBRL(t.valor)}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleDelete(t.id)}
                        className="p-1 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition"
                        title="Excluir transação"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
