import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppHeader } from '@/components/AppHeader'
import { BottomNav } from '@/components/BottomNav'
import { cartoesService } from '@/services/cartoes'
import type { Cartao } from '@/types/financial'
import { CreditCard, Plus, Pencil, Trash2, CalendarDays } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

const CORES = [
  '#6639A6',
  '#8B5CF6',
  '#1E293B',
  '#0EA5E9',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#EC4899',
]

export const CartoesPage: React.FC = () => {
  const navigate = useNavigate()
  const [cartoes, setCartoes] = useState<Cartao[]>([])
  const [loading, setLoading] = useState(true)

  // Modal de Criar / Editar Cartão
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCartao, setEditingCartao] = useState<Cartao | null>(null)
  const [nome, setNome] = useState('')
  const [diaVencimento, setDiaVencimento] = useState('10')
  const [cor, setCor] = useState(CORES[0])
  const [saving, setSaving] = useState(false)

  const loadCartoes = async () => {
    try {
      setLoading(true)
      const list = await cartoesService.list()
      setCartoes(list)
    } catch (err) {
      console.error(err)
      toast({ variant: 'destructive', title: 'Erro ao carregar cartões' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCartoes()
  }, [])

  const openCreate = () => {
    setEditingCartao(null)
    setNome('')
    setDiaVencimento('10')
    setCor(CORES[0])
    setModalOpen(true)
  }

  const openEdit = (c: Cartao) => {
    setEditingCartao(c)
    setNome(c.nome)
    setDiaVencimento(String(c.dia_vencimento))
    setCor(c.cor || CORES[0])
    setModalOpen(true)
  }

  const handleDelete = async (id: string, nomeCartao: string) => {
    if (!confirm(`Deseja realmente excluir o cartão "${nomeCartao}"?`)) return
    try {
      await cartoesService.delete(id)
      setCartoes((prev) => prev.filter((c) => c.id !== id))
      toast({ title: 'Cartão removido com sucesso' })
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao remover cartão' })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const dia = Number(diaVencimento)
    if (!nome.trim()) {
      toast({ variant: 'destructive', title: 'Informe o nome do cartão' })
      return
    }
    if (!dia || dia < 1 || dia > 31) {
      toast({
        variant: 'destructive',
        title: 'Dia de vencimento inválido',
        description: 'Informe um dia entre 1 e 31.',
      })
      return
    }

    setSaving(true)
    try {
      if (editingCartao) {
        const updated = await cartoesService.update(editingCartao.id, {
          nome: nome.trim(),
          dia_vencimento: dia,
          cor,
        })
        setCartoes((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
        toast({ title: 'Cartão atualizado com sucesso!' })
      } else {
        const created = await cartoesService.create({
          nome: nome.trim(),
          dia_vencimento: dia,
          cor,
        })
        setCartoes((prev) => [created, ...prev])
        toast({ title: 'Cartão criado com sucesso!' })
      }
      setModalOpen(false)
    } catch (err) {
      console.error(err)
      toast({ variant: 'destructive', title: 'Erro ao salvar cartão' })
    } finally {
      setSaving(false)
    }
  }

  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

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
              Cartões de crédito com dia de vencimento da fatura
            </p>
          </div>

          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-2xl bg-[#6639A6] text-white text-xs font-bold hover:bg-[#522c8a] transition shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Novo Cartão
          </button>
        </div>

        {/* Lista de Cartões */}
        <div className="bg-white rounded-3xl p-4 shadow-[0_4px_24px_rgba(102,57,166,0.06)] border border-[#EBE4F5] space-y-2">
          {loading ? (
            <div className="py-12 text-center text-xs text-gray-400">
              <span className="inline-block w-5 h-5 border-2 border-[#6639A6] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : cartoes.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-14 h-14 rounded-full bg-purple-100 text-[#6639A6] flex items-center justify-center mx-auto mb-3">
                <CreditCard className="w-7 h-7" />
              </div>
              <p className="text-xs font-bold text-gray-700">Nenhum cartão cadastrado</p>
              <p className="text-[11px] text-gray-500 mt-1 max-w-[240px] mx-auto">
                Cadastre um cartão informando o nome e o dia do vencimento — sem saldo inicial.
                Gastos a partir do vencimento entram na fatura do mês seguinte.
              </p>
            </div>
          ) : (
            cartoes.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl p-4 text-white shadow-md transition hover:scale-[1.01]"
                style={{
                  background: `linear-gradient(135deg, ${c.cor || '#6639A6'}, ${c.cor || '#6639A6'}CC)`,
                }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-black">{c.nome}</p>
                    <p className="text-[11px] text-white/80 flex items-center gap-1 mt-0.5">
                      <CalendarDays className="w-3 h-3" />
                      Vencimento: dia {c.dia_vencimento}
                    </p>
                  </div>
                  <CreditCard className="w-6 h-6 text-white/70" />
                </div>

                <p className="text-[10px] text-white/70 mt-3 leading-snug">
                  Compras feitas a partir do dia {c.dia_vencimento} caem na fatura do mês seguinte.
                </p>

                <div className="flex items-center justify-end gap-1.5 mt-2 -mb-1">
                  <button
                    type="button"
                    onClick={() => openEdit(c)}
                    className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 transition"
                    title="Editar cartão"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(c.id, c.nome)}
                    className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 transition"
                    title="Excluir cartão"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Modal de Criar / Editar Cartão */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-3xl p-5 max-w-xs w-full shadow-2xl space-y-3"
          >
            <h3 className="text-sm font-bold text-[#1F1438]">
              {editingCartao ? 'Editar Cartão' : 'Novo Cartão'}
            </h3>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Nome do cartão</label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Cartão de Crédito, Nubank..."
                className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs"
                required
              />
            </div>

            <div className="rounded-2xl bg-[#F6F3FB] border border-[#EBE4F5] px-3 py-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-gray-600">
                Cartões não possuem saldo
              </span>
              <button
                type="button"
                onClick={() => navigate('/nova-transacao')}
                className="text-[11px] font-bold text-[#6639A6] hover:underline"
              >
                + Lançar transação
              </button>
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Dia do vencimento</label>
              <input
                type="number"
                min={1}
                max={31}
                value={diaVencimento}
                onChange={(e) => setDiaVencimento(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs"
                required
              />
              <p className="text-[10px] text-gray-500 mt-1">
                Gastos a partir deste dia entram na fatura do mês seguinte.
              </p>
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Cor do cartão</label>
              <div className="flex items-center gap-2 flex-wrap">
                {CORES.map((cl) => (
                  <button
                    key={cl}
                    type="button"
                    onClick={() => setCor(cl)}
                    className={`w-7 h-7 rounded-full transition ${
                      cor === cl ? 'ring-2 ring-offset-2 ring-[#6639A6] scale-110' : ''
                    }`}
                    style={{ backgroundColor: cl }}
                    aria-label={`Cor ${cl}`}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex-1 py-2 text-xs font-semibold text-gray-600 rounded-xl bg-gray-100 hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2 text-xs font-bold text-white rounded-xl bg-[#6639A6] hover:bg-[#522c8a] disabled:opacity-60"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
