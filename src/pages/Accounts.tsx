import React, { useState, useEffect } from 'react'
import { AppHeader } from '@/components/AppHeader'
import { BottomNav } from '@/components/BottomNav'
import { contasService } from '@/services/contas'
import type { Conta, TipoConta } from '@/types/financial'
import {
  Landmark,
  Wallet,
  CreditCard,
  Plus,
  Trash2,
  Edit2,
  DollarSign,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'

export const AccountsPage: React.FC = () => {
  const [contas, setContas] = useState<Conta[]>([])
  const [loading, setLoading] = useState(true)

  // Modal de Criar / Editar Conta
  const [modalOpen, setModalOpen] = useState(false)
  const [editingConta, setEditingConta] = useState<Conta | null>(null)
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<TipoConta>('banco')
  const [saldoStr, setSaldoStr] = useState('0,00')
  const [cor, setCor] = useState('#820AD1')

  const loadContas = async () => {
    try {
      setLoading(true)
      const list = await contasService.list()
      setContas(list)
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar contas',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadContas()
  }, [])

  const handleOpenCreate = () => {
    setEditingConta(null)
    setNome('')
    setTipo('banco')
    setSaldoStr('0,00')
    setCor('#820AD1')
    setModalOpen(true)
  }

  const handleOpenEdit = (c: Conta) => {
    setEditingConta(c)
    setNome(c.nome)
    setTipo(c.tipo)
    setSaldoStr(c.saldo.toFixed(2).replace('.', ','))
    setCor(c.cor || '#820AD1')
    setModalOpen(true)
  }

  const handleDelete = async (id: string, nomeConta: string) => {
    if (!confirm(`Deseja realmente excluir a conta "${nomeConta}"?`)) return
    try {
      await contasService.delete(id)
      setContas((prev) => prev.filter((c) => c.id !== id))
      toast({ title: 'Conta removida com sucesso' })
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao remover conta' })
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const saldoNum = parseFloat(saldoStr.replace(/\./g, '').replace(',', '.')) || 0

    if (!nome.trim()) {
      toast({ variant: 'destructive', title: 'Informe o nome da conta' })
      return
    }

    try {
      if (editingConta) {
        const updated = await contasService.update(editingConta.id, {
          nome,
          tipo,
          saldo: saldoNum,
          cor,
        })
        setContas((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
        toast({ title: 'Conta atualizada!' })
      } else {
        const created = await contasService.create({
          nome,
          tipo,
          saldo: saldoNum,
          cor,
        })
        setContas((prev) => [...prev, created])
        toast({ title: 'Conta cadastrada com sucesso!' })
      }
      setModalOpen(false)
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao salvar conta' })
    }
  }

  const totalPatrimonio = contas.reduce((acc, c) => acc + (c.tipo === 'cartao' ? 0 : c.saldo), 0)

  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

  return (
    <div className="min-h-screen bg-[#F6F3FB] text-[#1F1438] pb-24">
      <AppHeader />

      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">
        {/* Header da seção */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-black text-[#1F1438]">Minhas Contas</h1>
            <p className="text-xs text-gray-500">
              Gerencie suas carteiras, bancos e cartões de crédito
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-[#6639A6] hover:bg-[#522c8a] text-white text-xs font-bold shadow-md transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nova Conta
          </button>
        </div>

        {/* Resumo do Patrimônio Líquido */}
        <div className="bg-white rounded-3xl p-5 shadow-[0_4px_24px_rgba(102,57,166,0.06)] border border-[#EBE4F5] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-purple-100 text-[#6639A6] flex items-center justify-center">
              <DollarSign className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Saldo Total
              </p>
              <p className="text-xl font-black text-[#1F1438]">{formatBRL(totalPatrimonio)}</p>
            </div>
          </div>

          <span className="text-[11px] font-semibold text-[#6639A6] bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200">
            {contas.length} {contas.length === 1 ? 'conta' : 'contas'}
          </span>
        </div>

        {/* Lista de Contas */}
        <div className="space-y-2.5">
          {loading ? (
            <div className="py-12 text-center text-xs text-gray-400">
              <span className="inline-block w-5 h-5 border-2 border-[#6639A6] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : contas.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center text-xs text-gray-400 border border-gray-100">
              Você ainda não cadastrou nenhuma conta.
            </div>
          ) : (
            contas.map((c) => (
              <div
                key={c.id}
                className="bg-white rounded-3xl p-4 shadow-[0_4px_20px_rgba(102,57,166,0.04)] border border-[#EBE4F5] flex items-center justify-between hover:border-purple-200 transition"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-xs"
                    style={{ backgroundColor: c.cor || '#6639A6' }}
                  >
                    {c.tipo === 'cartao' ? (
                      <CreditCard className="w-5 h-5" />
                    ) : c.tipo === 'carteira' ? (
                      <Wallet className="w-5 h-5" />
                    ) : (
                      <Landmark className="w-5 h-5" />
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm font-black text-gray-900 leading-tight">{c.nome}</h3>
                    <p className="text-[11px] text-gray-500 capitalize flex items-center gap-1 mt-0.5">
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: c.cor || '#6639A6' }}
                      />
                      {c.tipo}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p
                      className={`text-sm font-black ${
                        c.saldo < 0 ? 'text-rose-600' : 'text-gray-900'
                      }`}
                    >
                      {formatBRL(c.saldo)}
                    </p>
                    <span className="text-[10px] text-gray-400">Saldo atual</span>
                  </div>

                  <div className="flex items-center gap-0.5 ml-1 border-l border-gray-100 pl-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(c)}
                      className="p-1.5 text-gray-400 hover:text-[#6639A6] rounded-lg hover:bg-purple-50 transition"
                      title="Editar conta"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id, c.nome)}
                      className="p-1.5 text-gray-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition"
                      title="Excluir conta"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal de Criação / Edição de Conta */}
        {modalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
              <h2 className="text-base font-black text-[#1F1438]">
                {editingConta ? 'Editar Conta' : 'Nova Conta'}
              </h2>

              <form onSubmit={handleSave} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Nome da Conta
                  </label>
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Nubank, Itaú, Carteira"
                    required
                    className="w-full h-11 px-3.5 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-[#6639A6]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Tipo de Conta
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['carteira', 'banco', 'cartao'] as TipoConta[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTipo(t)}
                        className={`py-2 px-1 text-xs font-bold rounded-xl capitalize transition border ${
                          tipo === t
                            ? 'bg-[#6639A6] text-white border-[#6639A6]'
                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Saldo Inicial (R$)
                  </label>
                  <input
                    type="text"
                    value={saldoStr}
                    onChange={(e) => setSaldoStr(e.target.value)}
                    placeholder="0,00"
                    required
                    className="w-full h-11 px-3.5 rounded-2xl border border-gray-200 text-sm font-bold focus:outline-none focus:border-[#6639A6]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Cor de Destaque
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={cor}
                      onChange={(e) => setCor(e.target.value)}
                      className="w-10 h-10 p-0.5 rounded-xl border border-gray-200 cursor-pointer"
                    />
                    <span className="text-xs font-mono text-gray-600">{cor}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="flex-1 py-2.5 text-xs font-semibold text-gray-600 rounded-2xl bg-gray-100 hover:bg-gray-200"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 text-xs font-bold text-white rounded-2xl bg-[#6639A6] hover:bg-[#522c8a] shadow-md"
                  >
                    Salvar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
