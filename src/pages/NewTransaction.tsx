import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppHeader } from '@/components/AppHeader'
import { BottomNav } from '@/components/BottomNav'
import { transacoesService } from '@/services/transacoes'
import { contasService } from '@/services/contas'
import { categoriasService } from '@/services/categorias'
import { useAuth } from '@/context/AuthContext'
import type { Conta, Categoria, TipoTransacao } from '@/types/financial'
import {
  TrendingDown,
  TrendingUp,
  ArrowLeft,
  Calendar,
  Lock,
  Sparkles,
  Tag,
  Landmark,
  Plus,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'

export const NewTransactionPage: React.FC = () => {
  const navigate = useNavigate()
  const { plan, canAccessRecurring } = useAuth()

  const [tipo, setTipo] = useState<TipoTransacao>('despesa')
  const [descricao, setDescricao] = useState('')
  const [valorStr, setValorStr] = useState('')
  const [dataStr, setDataStr] = useState(() => new Date().toISOString().slice(0, 10))
  const [contaId, setContaId] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [recorrente, setRecorrente] = useState(false)
  const [recorrenciaPeriodo, setRecorrenciaPeriodo] = useState<'mensal' | 'anual'>('mensal')

  const [contas, setContas] = useState<Conta[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(false)

  // Criar categoria personalizada direto na tela
  const [showNewCatModal, setShowNewCatModal] = useState(false)
  const [newCatNome, setNewCatNome] = useState('')
  const [newCatCor, setNewCatCor] = useState('#8B5CF6')

  useEffect(() => {
    Promise.all([contasService.list(), categoriasService.list()]).then(([cts, cats]) => {
      setContas(cts)
      if (cts.length > 0) setContaId(cts[0].id)
      setCategorias(cats)
      if (cats.length > 0) setCategoriaId(cats[0].id)
    })
  }, [])

  const handleCreateCategoria = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCatNome) return
    try {
      const created = await categoriasService.create({
        nome: newCatNome,
        cor: newCatCor,
        tipo: 'despesa',
      })
      setCategorias((prev) => [...prev, created])
      setCategoriaId(created.id)
      setShowNewCatModal(false)
      setNewCatNome('')
      toast({ title: 'Categoria criada com sucesso!' })
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao criar categoria' })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const parsedValor = parseFloat(valorStr.replace(/\./g, '').replace(',', '.'))
    if (!descricao.trim()) {
      toast({ variant: 'destructive', title: 'Informe a descrição' })
      return
    }
    if (!parsedValor || parsedValor <= 0) {
      toast({ variant: 'destructive', title: 'Informe um valor válido' })
      return
    }
    if (!contaId) {
      toast({ variant: 'destructive', title: 'Selecione uma conta' })
      return
    }

    if (recorrente && !canAccessRecurring) {
      toast({
        variant: 'destructive',
        title: 'Recursos Recorrentes',
        description: 'Despesas recorrentes são exclusivas dos planos VIP e Premium.',
      })
      return
    }

    setLoading(true)
    try {
      await transacoesService.create({
        descricao,
        valor: parsedValor,
        tipo,
        data: dataStr,
        conta_id: contaId,
        categoria_id: categoriaId || undefined,
        recorrente: recorrente && canAccessRecurring,
        recorrencia_periodo: recorrente ? recorrenciaPeriodo : undefined,
        pago: true,
      })

      toast({
        title: 'Transação adicionada!',
        description: 'Sua conta e extrato foram atualizados.',
      })
      navigate('/')
    } catch (err) {
      console.error(err)
      toast({
        variant: 'destructive',
        title: 'Erro ao cadastrar',
        description: 'Não foi possível salvar a transação.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F6F3FB] text-[#1F1438] pb-24">
      <AppHeader showAddButton={false} />

      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl bg-white border border-[#EBE4F5] text-gray-700 hover:bg-gray-50 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-base font-black text-[#1F1438]">Nova Transação</h1>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-3xl p-5 shadow-[0_4px_24px_rgba(102,57,166,0.06)] border border-[#EBE4F5] space-y-4"
        >
          {/* Alternador Receita / Despesa */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-[#F4F1F9] rounded-2xl">
            <button
              type="button"
              onClick={() => setTipo('despesa')}
              className={`py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition ${
                tipo === 'despesa'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <TrendingDown className="w-4 h-4" />
              Despesa
            </button>
            <button
              type="button"
              onClick={() => setTipo('receita')}
              className={`py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition ${
                tipo === 'receita'
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Receita
            </button>
          </div>

          {/* Campo de Valor */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Valor (R$)</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">
                R$
              </span>
              <input
                type="text"
                value={valorStr}
                onChange={(e) => setValorStr(e.target.value)}
                placeholder="0,00"
                required
                className="w-full h-12 pl-10 pr-3 rounded-2xl border border-[#D9CDEB] bg-white text-lg font-black text-[#1F1438] focus:outline-none focus:border-[#6639A6] focus:ring-2 focus:ring-[#6639A6]/15 transition"
              />
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Descrição</label>
            <input
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Supermercado, Salário, Internet"
              required
              className="w-full h-11 px-3.5 rounded-2xl border border-[#D9CDEB] bg-white text-sm text-[#1F1438] focus:outline-none focus:border-[#6639A6] transition"
            />
          </div>

          {/* Data */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Data da Movimentação
            </label>
            <div className="relative">
              <input
                type="date"
                value={dataStr}
                onChange={(e) => setDataStr(e.target.value)}
                required
                className="w-full h-11 px-3.5 rounded-2xl border border-[#D9CDEB] bg-white text-sm text-[#1F1438] focus:outline-none focus:border-[#6639A6] transition"
              />
            </div>
          </div>

          {/* Conta de Pagamento / Depósito */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Landmark className="w-3.5 h-3.5 text-[#6639A6]" />
                Conta / Cartão
              </span>
              <button
                type="button"
                onClick={() => navigate('/contas')}
                className="text-[11px] text-[#6639A6] hover:underline"
              >
                Gerenciar
              </button>
            </label>
            <select
              value={contaId}
              onChange={(e) => setContaId(e.target.value)}
              required
              className="w-full h-11 px-3.5 rounded-2xl border border-[#D9CDEB] bg-white text-sm text-[#1F1438] focus:outline-none focus:border-[#6639A6] transition"
            >
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} ({c.tipo}) • Saldo:{' '}
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    c.saldo,
                  )}
                </option>
              ))}
            </select>
          </div>

          {/* Categoria */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-[#6639A6]" />
                Categoria
              </label>
              <button
                type="button"
                onClick={() => setShowNewCatModal(true)}
                className="text-[11px] text-[#6639A6] font-semibold hover:underline flex items-center gap-0.5"
              >
                <Plus className="w-3 h-3" />
                Nova categoria
              </button>
            </div>
            <select
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              className="w-full h-11 px-3.5 rounded-2xl border border-[#D9CDEB] bg-white text-sm text-[#1F1438] focus:outline-none focus:border-[#6639A6] transition"
            >
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Recorrente (Regra do Plano VIP / Premium) */}
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between p-3 rounded-2xl bg-purple-50/70 border border-purple-100">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="recorrente"
                  checked={recorrente}
                  onChange={(e) => {
                    if (!canAccessRecurring) {
                      toast({
                        variant: 'destructive',
                        title: 'Recorrentes é VIP / Premium',
                        description: 'Faça upgrade para automatizar despesas fixas todo mês!',
                      })
                      return
                    }
                    setRecorrente(e.target.checked)
                  }}
                  className="w-4 h-4 rounded text-[#6639A6] focus:ring-[#6639A6]"
                />
                <label
                  htmlFor="recorrente"
                  className="text-xs font-bold text-gray-800 cursor-pointer"
                >
                  Despesa / Receita Recorrente
                </label>
              </div>

              {!canAccessRecurring && (
                <span className="inline-flex items-center gap-1 text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-[#6639A6] text-white">
                  <Lock className="w-2.5 h-2.5" /> VIP
                </span>
              )}
            </div>

            {recorrente && canAccessRecurring && (
              <div className="mt-2 pl-2">
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                  Periodicidade
                </label>
                <select
                  value={recorrenciaPeriodo}
                  onChange={(e) => setRecorrenciaPeriodo(e.target.value as 'mensal' | 'anual')}
                  className="w-full h-9 px-3 rounded-xl border border-purple-200 text-xs text-[#1F1438]"
                >
                  <option value="mensal">Repete todo mês (Mensal)</option>
                  <option value="anual">Repete todo ano (Anual)</option>
                </select>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-2xl bg-[#6639A6] hover:bg-[#522c8a] text-white font-bold text-sm shadow-[0_8px_20px_rgba(102,57,166,0.3)] transition cursor-pointer"
          >
            {loading ? 'Salvando...' : 'Confirmar Lançamento'}
          </button>
        </form>

        {/* Modal de Criação Rápida de Categoria */}
        {showNewCatModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-5 max-w-xs w-full shadow-2xl space-y-3">
              <h3 className="text-sm font-bold text-[#1F1438]">Nova Categoria</h3>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Nome</label>
                <input
                  type="text"
                  value={newCatNome}
                  onChange={(e) => setNewCatNome(e.target.value)}
                  placeholder="Ex: Assinaturas"
                  className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Cor da Categoria</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={newCatCor}
                    onChange={(e) => setNewCatCor(e.target.value)}
                    className="w-10 h-10 p-0.5 rounded-lg border border-gray-200 cursor-pointer"
                  />
                  <span className="text-xs font-mono text-gray-600">{newCatCor}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewCatModal(false)}
                  className="flex-1 py-2 text-xs font-semibold text-gray-600 rounded-xl bg-gray-100 hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreateCategoria}
                  className="flex-1 py-2 text-xs font-bold text-white rounded-xl bg-[#6639A6] hover:bg-[#522c8a]"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
