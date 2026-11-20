import React, { useState, useEffect } from 'react'
import { AppHeader } from '@/components/AppHeader'
import { BottomNav } from '@/components/BottomNav'
import { transacoesService, mesDaFatura, rotuloFatura } from '@/services/transacoes'
import { cartoesService } from '@/services/cartoes'
import type { Cartao, Transacao } from '@/types/financial'
import { CreditCard, Plus, X, Trash2 } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { formatBRLPublic } from '@/lib/format'

/**
 * Tela de Cartões — lista os cartões do usuário com o resumo das faturas
 * (mês atual e próximo, já considerando a regra do vencimento) e permite
 * adicionar novos cartões (nome + dia de vencimento).
 */
export const CartoesPage: React.FC = () => {
  const [cartoes, setCartoes] = useState<Cartao[]>([])
  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  // Formulário de novo cartão
  const [nomeCartao, setNomeCartao] = useState('')
  const [diaVenc, setDiaVenc] = useState('10')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      const [cs, txs] = await Promise.all([cartoesService.list(), transacoesService.list()])
      setCartoes(cs)
      setTransacoes(txs.filter((t) => Boolean(t.cartao_id)))
    } catch (err) {
      console.error(err)
      toast({ variant: 'destructive', title: 'Erro ao carregar cartões' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const hoje = new Date()
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  const proximaData = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1)
  const mesProximo = `${proximaData.getFullYear()}-${String(proximaData.getMonth() + 1).padStart(2, '0')}`

  const faturasDoCartao = (cartaoId: string) => transacoes.filter((t) => t.cartao_id === cartaoId)

  const salvarCartao = async () => {
    const dia = Number(diaVenc)
    if (!nomeCartao.trim()) {
      toast({ variant: 'destructive', title: 'Informe o nome do cartão' })
      return
    }
    if (!dia || dia < 1 || dia > 28) {
      toast({ variant: 'destructive', title: 'Dia de vencimento deve ser entre 1 e 28' })
      return
    }
    setSaving(true)
    try {
      await cartoesService.create({ nome: nomeCartao.trim(), dia_vencimento: dia })
      setNomeCartao('')
      setDiaVenc('10')
      setShowAdd(false)
      toast({ title: 'Cartão adicionado' })
      await load()
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao salvar cartão' })
    } finally {
      setSaving(false)
    }
  }

  const excluirCartao = async (id: string) => {
    if (!confirm('Excluir este cartão? Os lançamentos dele continuarão no extrato.')) return
    try {
      await cartoesService.delete(id)
      toast({ title: 'Cartão excluído' })
      await load()
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao excluir cartão' })
    }
  }

  return (
    <div className="min-h-screen bg-[#F6F3FB] text-[#1F1438] pb-24">
      <AppHeader />

      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-black text-[#1F1438] flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-[#6639A6]" />
              Meus Cartões
            </h1>
            <p className="text-xs text-gray-500">
              Faturas com gastos a partir do vencimento caindo no mês seguinte
            </p>
          </div>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="flex items-center gap-1 bg-[#6639A6] hover:bg-[#4A247A] text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" /> Adicionar
          </button>
        </div>

        {showAdd && (
          <section className="bg-white rounded-3xl p-5 shadow-[0_4px_24px_rgba(102,57,166,0.06)] border border-[#EBE4F5]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-black text-[#1F1438]">Adicionar cartão</h2>
              <button
                onClick={() => setShowAdd(false)}
                className="p-1 rounded-full hover:bg-gray-100"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600">Nome do cartão *</label>
                <input
                  value={nomeCartao}
                  onChange={(e) => setNomeCartao(e.target.value)}
                  placeholder="Ex.: Nubank, Itaú…"
                  className="w-full mt-1 rounded-xl border border-[#ECE6F2] bg-[#FAF8FC] px-3 py-2.5 text-sm outline-none focus:border-[#6639A6]"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Dia do vencimento *</label>
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={diaVenc}
                  onChange={(e) => setDiaVenc(e.target.value)}
                  className="w-full mt-1 rounded-xl border border-[#ECE6F2] bg-[#FAF8FC] px-3 py-2.5 text-sm outline-none focus:border-[#6639A6]"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Compras feitas a partir desse dia caem na fatura do mês seguinte.
                </p>
              </div>
              <button
                onClick={() => void salvarCartao()}
                disabled={saving}
                className="w-full bg-[#6639A6] hover:bg-[#4A247A] disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                {saving ? 'Salvando…' : 'Salvar cartão'}
              </button>
            </div>
          </section>
        )}

        {loading ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-[#EBE4F5]">
            <span className="inline-block w-5 h-5 border-2 border-[#6639A6] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : cartoes.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-[#EBE4F5]">
            <div className="w-14 h-14 rounded-full bg-purple-100 text-[#6639A6] flex items-center justify-center mx-auto mb-3">
              <CreditCard className="w-7 h-7" />
            </div>
            <p className="text-xs font-bold text-gray-700">Nenhum cartão cadastrado</p>
            <p className="text-[11px] text-gray-500 mt-1 max-w-[240px] mx-auto">
              Toque em "Adicionar" para cadastrar um cartão e lançar gastos no crédito.
            </p>
          </div>
        ) : (
          cartoes.map((cartao) => {
            const doCartao = faturasDoCartao(cartao.id)
            const faturaAtual = doCartao.filter((t) => mesDaFatura(t, [cartao]) === mesAtual)
            const faturaProxima = doCartao.filter((t) => mesDaFatura(t, [cartao]) === mesProximo)
            const soma = (list: Transacao[]) => list.reduce((acc, t) => acc + t.valor, 0)
            return (
              <div key={cartao.id} className="space-y-3">
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
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => void excluirCartao(cartao.id)}
                        className="p-1 text-white/60 hover:text-white transition"
                        title="Excluir cartão"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <CreditCard className="w-6 h-6 text-white/70" />
                    </div>
                  </div>
                  <p className="text-[10px] text-white/70 mt-3 leading-snug">
                    Compras feitas a partir do dia {cartao.dia_vencimento} caem na fatura do mês
                    seguinte.
                  </p>
                </div>

                {/* Fatura atual */}
                <FaturaCard
                  titulo={`${cartao.nome} · Fatura ${rotuloFatura(mesAtual)}`}
                  itens={faturaAtual}
                  total={soma(faturaAtual)}
                />

                {/* Fatura do próximo mês */}
                <FaturaCard
                  titulo={`${cartao.nome} · Fatura ${rotuloFatura(mesProximo)}`}
                  itens={faturaProxima}
                  total={soma(faturaProxima)}
                />
              </div>
            )
          })
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
