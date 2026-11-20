import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AppHeader } from '@/components/AppHeader'
import { BottomNav } from '@/components/BottomNav'
import { transacoesService } from '@/services/transacoes'
import { useAuth } from '@/context/AuthContext'
import type { Transacao } from '@/types/financial'
import { Repeat, Lock, Sparkles, TrendingDown, TrendingUp, Calendar, Plus } from 'lucide-react'

export const RecurringPage: React.FC = () => {
  const { plan, canAccessRecurring } = useAuth()
  const [recorrentes, setRecorrentes] = useState<Transacao[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    if (!canAccessRecurring) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const list = await transacoesService.list({ recorrente: true })
      setRecorrentes(list)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [canAccessRecurring])

  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

  const totalRecorrenteDespesas = recorrentes
    .filter((r) => r.tipo === 'despesa')
    .reduce((acc, r) => acc + r.valor, 0)

  const totalRecorrenteReceitas = recorrentes
    .filter((r) => r.tipo === 'receita')
    .reduce((acc, r) => acc + r.valor, 0)

  return (
    <div className="min-h-screen bg-[#F6F3FB] text-[#1F1438] pb-24">
      <AppHeader />

      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-black text-[#1F1438] flex items-center gap-1.5">
              <Repeat className="w-4 h-4 text-[#6639A6]" />
              Despesas e Receitas Recorrentes
            </h1>
            <p className="text-xs text-gray-500">Assinaturas, salários e contas fixas mensais</p>
          </div>

          {canAccessRecurring && (
            <Link
              to="/nova-transacao"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-2xl bg-[#6639A6] text-white text-xs font-bold hover:bg-[#522c8a] transition shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar
            </Link>
          )}
        </div>

        {/* Bloqueio para Plano Free */}
        {!canAccessRecurring ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-purple-200 shadow-md">
            <div className="w-14 h-14 rounded-full bg-purple-100 text-[#6639A6] flex items-center justify-center mx-auto mb-3">
              <Lock className="w-7 h-7" />
            </div>
            <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#6639A6] text-white text-[10px] font-black uppercase mb-2">
              Recurso VIP & Premium
            </span>
            <h3 className="text-base font-black text-[#1F1438]">
              Controle Automático de Recorrências
            </h3>
            <p className="text-xs text-gray-600 mt-2 max-w-xs mx-auto">
              No plano <strong>Free</strong> você pode cadastrar suas despesas do dia a dia
              normalmente, mas os lançamentos fixos automáticos que se repetem todo mês são
              exclusivos dos assinantes <strong>VIP</strong> e <strong>Premium</strong>.
            </p>

            <Link
              to="/planos"
              className="inline-flex items-center gap-2 mt-5 px-6 py-2.5 rounded-full bg-gradient-to-r from-[#4A247A] to-[#6639A6] text-white text-xs font-bold shadow-md hover:opacity-95 transition"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              Ver Comparativo de Planos
            </Link>
          </div>
        ) : (
          /* Conteúdo liberado para VIP e Premium */
          <>
            {/* Totais Fixos Mensais */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white rounded-2xl p-3 border border-emerald-100 shadow-xs">
                <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" /> Receitas Fixas
                </span>
                <p className="text-sm font-black text-emerald-800 mt-0.5">
                  {formatBRL(totalRecorrenteReceitas)}/mês
                </p>
              </div>

              <div className="bg-white rounded-2xl p-3 border border-rose-100 shadow-xs">
                <span className="text-[11px] font-bold text-rose-700 flex items-center gap-1">
                  <TrendingDown className="w-3.5 h-3.5" /> Despesas Fixas
                </span>
                <p className="text-sm font-black text-rose-800 mt-0.5">
                  {formatBRL(totalRecorrenteDespesas)}/mês
                </p>
              </div>
            </div>

            {/* Lista de Transações Recorrentes */}
            <div className="bg-white rounded-3xl p-5 shadow-[0_4px_24px_rgba(102,57,166,0.06)] border border-[#EBE4F5] space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {recorrentes.length}{' '}
                  {recorrentes.length === 1 ? 'Item Recorrente' : 'Itens Recorrentes'}
                </span>
                <span className="text-[11px] font-semibold text-[#6639A6] bg-purple-50 px-2 py-0.5 rounded-md">
                  Plano {plan.toUpperCase()}
                </span>
              </div>

              {loading ? (
                <div className="py-12 text-center text-xs text-gray-400">
                  <span className="inline-block w-5 h-5 border-2 border-[#6639A6] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : recorrentes.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-400">
                  Nenhuma transação marcada como recorrente ainda. Ao cadastrar uma despesa ou
                  receita, marque a opção &quot;Despesa / Receita Recorrente&quot;.
                </div>
              ) : (
                recorrentes.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-[#FDFBFD] border border-gray-100 hover:border-purple-200 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                        style={{
                          backgroundColor: r.expand?.categoria_id?.cor || '#6639A6',
                        }}
                      >
                        <Repeat className="w-4 h-4" />
                      </div>

                      <div>
                        <p className="text-xs font-bold text-gray-900 leading-tight">
                          {r.descricao}
                        </p>
                        <p className="text-[10px] text-gray-500 flex items-center gap-1.5 mt-0.5">
                          <span>{r.expand?.categoria_id?.nome || 'Geral'}</span>
                          <span>•</span>
                          <span className="capitalize">{r.recorrencia_periodo || 'Mensal'}</span>
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`text-xs font-black ${
                          r.tipo === 'receita' ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {r.tipo === 'receita' ? '+' : '-'} {formatBRL(r.valor)}
                      </span>
                      <p className="text-[10px] text-gray-400">Todo mês</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
