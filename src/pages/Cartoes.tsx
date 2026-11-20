import React, { useState, useEffect } from 'react'
import { AppHeader } from '@/components/AppHeader'
import { BottomNav } from '@/components/BottomNav'
import { transacoesService, mesDaFatura, rotuloFatura } from '@/services/transacoes'
import { cartoesService } from '@/services/cartoes'
import type { Cartao, Transacao } from '@/types/financial'
import { CreditCard } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { formatBRLPublic } from '@/lib/format'

/**
 * Tela de Cartões — mostra o cartão do usuário com o resumo da fatura
 * (mês atual e próximo, já considerando a regra do vencimento).
 */
export const CartoesPage: React.FC = () => {
  const [cartao, setCartao] = useState<Cartao | null>(null)
  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [cartoes, txs] = await Promise.all([cartoesService.list(), transacoesService.list()])
        setCartao(cartoes[0] || null)
        setTransacoes(txs.filter((t) => Boolean(t.cartao_id)))
      } catch (err) {
        console.error(err)
        toast({ variant: 'destructive', title: 'Erro ao carregar cartões' })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const hoje = new Date()
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  const proximaData = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1)
  const mesProximo = `${proximaData.getFullYear()}-${String(proximaData.getMonth() + 1).padStart(2, '0')}`

  const faturaAtual = transacoes.filter(
    (t) => t.cartao_id === cartao?.id && mesDaFatura(t, [cartao!]) === mesAtual,
  )
  const faturaProxima = transacoes.filter(
    (t) => t.cartao_id === cartao?.id && mesDaFatura(t, [cartao!]) === mesProximo,
  )

  const soma = (list: Transacao[]) => list.reduce((acc, t) => acc + t.valor, 0)

  return (
    <div className="min-h-screen bg-[#F6F3FB] text-[#1F1438] pb-24">
      <AppHeader />

      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-black text-[#1F1438] flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-[#6639A6]" />
              Meu Cartão
            </h1>
            <p className="text-xs text-gray-500">
              Faturas com gastos a partir do vencimento caindo no mês seguinte
            </p>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-[#EBE4F5]">
            <span className="inline-block w-5 h-5 border-2 border-[#6639A6] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !cartao ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-[#EBE4F5]">
            <div className="w-14 h-14 rounded-full bg-purple-100 text-[#6639A6] flex items-center justify-center mx-auto mb-3">
              <CreditCard className="w-7 h-7" />
            </div>
            <p className="text-xs font-bold text-gray-700">Nenhum cartão cadastrado</p>
            <p className="text-[11px] text-gray-500 mt-1 max-w-[240px] mx-auto">
              Cadastre um cartão em "Cartões" para lançar gastos no crédito.
            </p>
          </div>
        ) : (
          <>
            {/* Cartão */}
            <div
              className="rounded-3xl p-5 text-white shadow-md"
              style={{
                background: `linear-gradient(135deg, ${cartao.cor || '#6639A6'}, ${cartao.cor || '#6639A6'}CC)`,
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-black">{cartao.nome}</p>
                  <p className="text-[11px] text-white/80 mt-0.5">
                    Vencimento: dia {cartao.dia_vencimento}
                  </p>
                </div>
                <CreditCard className="w-6 h-6 text-white/70" />
              </div>
              <p className="text-[10px] text-white/70 mt-3 leading-snug">
                Compras feitas a partir do dia {cartao.dia_vencimento} caem na fatura do mês
                seguinte.
              </p>
            </div>

            {/* Fatura atual */}
            <FaturaCard
              titulo={`Fatura ${rotuloFatura(mesAtual)}`}
              itens={faturaAtual}
              total={soma(faturaAtual)}
            />

            {/* Fatura do próximo mês */}
            <FaturaCard
              titulo={`Fatura ${rotuloFatura(mesProximo)}`}
              itens={faturaProxima}
              total={soma(faturaProxima)}
            />
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}

const FaturaCard: React.FC<{ titulo: string; itens: Transacao[]; total: number }> = ({
  titulo,
  itens,
  total,
}) => (
  <section className="bg-white rounded-3xl p-5 shadow-[0_4px_24px_rgba(102,57,166,0.06)] border border-[#EBE4F5]">
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-sm font-black text-[#6639A6]">{titulo}</h3>
    </div>
    {itens.length === 0 ? (
      <p className="py-4 text-center text-xs text-gray-400">Nenhum gasto nesta fatura.</p>
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
    <div className="pt-3 mt-1 border-t border-gray-100">
      <span className="text-[11px] text-gray-500 font-semibold">Total</span>
      <p className="text-sm font-black text-[#1D4ED8]">{formatBRLPublic(total)}</p>
    </div>
  </section>
)
