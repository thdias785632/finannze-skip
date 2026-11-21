import React, { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom'
import { AppHeader } from '@/components/AppHeader'
import { BottomNav } from '@/components/BottomNav'
import { cartoesService } from '@/services/cartoes'
import { categoriasService } from '@/services/categorias'
import { transacoesService, mesDaFatura } from '@/services/transacoes'
import type { Cartao, Categoria, Transacao } from '@/types/financial'
import { toast } from '@/hooks/use-toast'
import { useAuth } from '@/context/AuthContext'
import { ArrowLeft, CreditCard } from 'lucide-react'

/**
 * Edição de uma movimentação EXISTENTE — despesa de cartão. Abre o mesmo
 * formulário da nova movimentação, já preenchido com os dados atuais, e salva
 * com update() sobre o registro (nunca cria outro lançamento).
 */
export const EditarTransacaoPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()

  // Tela de onde a edição foi aberta (Cartões, Extrato…): volta para ela ao salvar.
  const paginaOrigem: string =
    (location.state as { from?: string } | null)?.from &&
    typeof (location.state as { from?: string }).from === 'string'
      ? ((location.state as { from?: string }).from as string)
      : '/cartoes'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const [transacao, setTransacao] = useState<Transacao | null>(null)
  const [cartoes, setCartoes] = useState<Cartao[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])

  const [cartaoId, setCartaoId] = useState('')
  const [dataReferencia, setDataReferencia] = useState('')
  const [nome, setNome] = useState('')
  const [valor, setValor] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [recorrente, setRecorrente] = useState<'sim' | 'nao'>('nao')
  const { canAccessRecurring } = useAuth()

  useEffect(() => {
    const load = async () => {
      if (!id) {
        setNotFound(true)
        setLoading(false)
        return
      }
      try {
        const [t, cs, cats] = await Promise.all([
          transacoesService.get(id),
          cartoesService.list(),
          categoriasService.list(),
        ])
        if (t.tipo !== 'despesa' || !t.cartao_id) {
          // A edição dedicada cobre apenas despesas de cartão.
          setNotFound(true)
          return
        }
        setTransacao(t)
        setCartoes(cs)
        setCategorias(cats)
        setCartaoId(t.cartao_id)
        setDataReferencia(String(t.data).slice(0, 10))
        setNome(t.descricao)
        setValor(String(t.valor))
        setCategoriaId(t.categoria_id || '')
        setRecorrente(t.recorrente ? 'sim' : 'nao')
      } catch (err) {
        console.error(err)
        setNotFound(true)
        toast({ variant: 'destructive', title: 'Erro ao carregar a movimentação' })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const categoriaAtual = categorias.find((c) => c.id === categoriaId)
  const categoriasDespesa = categorias.filter(
    (c) => c.tipo === 'despesa' || c.tipo === 'ambos' || c.id === categoriaId,
  )

  const cartaoSelecionado = cartoes.find((c) => c.id === cartaoId)

  // Prévia da fatura após a edição, com a regra do vencimento (mesDaFatura):
  // gasto no dia do vencimento ou depois cai na fatura do mês seguinte.
  const faturaPrevista = transacao
    ? mesDaFatura(
        {
          ...transacao,
          data: dataReferencia,
          cartao_id: cartaoId || undefined,
        },
        cartaoSelecionado ? [cartaoSelecionado] : cartoes,
      )
    : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!transacao) return

    const valorNum = Number(valor.replace(',', '.'))
    if (!nome.trim()) {
      toast({ variant: 'destructive', title: 'Informe o nome da movimentação' })
      return
    }
    if (!valorNum || valorNum <= 0) {
      toast({ variant: 'destructive', title: 'Informe um valor válido' })
      return
    }
    if (!cartaoId) {
      toast({ variant: 'destructive', title: 'Selecione o cartão' })
      return
    }
    if (!categoriaId) {
      toast({ variant: 'destructive', title: 'Selecione a categoria' })
      return
    }

    setSaving(true)
    try {
      // Update sobre o registro existente — nunca cria movimentação nova.
      await transacoesService.update(transacao.id, {
        descricao: nome.trim(),
        valor: valorNum,
        tipo: 'despesa',
        data: dataReferencia,
        cartao_id: cartaoId,
        categoria_id: categoriaId,
        recorrente: canAccessRecurring && recorrente === 'sim',
      })
      toast({
        title: 'Despesa atualizada!',
        description: 'O valor foi atualizado na fatura e no extrato.',
      })
      navigate(paginaOrigem)
    } catch (err) {
      console.error(err)
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: 'Verifique os campos e tente novamente.',
      })
    } finally {
      setSaving(false)
    }
  }

  const inputCls =
    'w-full h-11 px-3 rounded-xl border border-gray-200 text-sm text-[#1F1438] bg-white focus:outline-none focus:ring-2 focus:ring-[#6639A6]/30 focus:border-[#6639A6]'
  const labelCls = 'block text-[11px] font-semibold text-gray-600 mb-1'

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F3FB] flex items-center justify-center">
        <span className="inline-block w-6 h-6 border-2 border-[#6639A6] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (notFound || !transacao) {
    return (
      <div className="min-h-screen bg-[#F6F3FB] text-[#1F1438] pb-24">
        <AppHeader />
        <main className="max-w-md mx-auto px-4 pt-10">
          <div className="bg-white rounded-3xl p-8 text-center border border-[#EBE4F5]">
            <p className="text-sm font-bold text-gray-700">Movimentação não encontrada</p>
            <p className="text-xs text-gray-500 mt-1">
              Ela pode ter sido excluída ou não é uma despesa de cartão.
            </p>
            <button
              onClick={() => navigate(-1)}
              className="mt-4 px-5 py-2.5 rounded-xl bg-[#6639A6] text-white text-xs font-bold"
            >
              Voltar
            </button>
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F6F3FB] text-[#1F1438] pb-24">
      <AppHeader />

      <main className="max-w-md mx-auto px-4 pt-4 pb-10">
        <div className="bg-white rounded-3xl p-5 shadow-[0_4px_24px_rgba(102,57,166,0.08)] border border-[#EBE4F5]">
          {/* Cabeçalho do modo edição */}
          <div className="flex items-center gap-2 mb-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-1.5 rounded-full hover:bg-[#F1EAF9] transition"
              aria-label="Voltar"
            >
              <ArrowLeft className="w-4 h-4 text-[#6639A6]" />
            </button>
            <h1 className="text-sm font-black text-[#1F1438] flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-[#6639A6]" />
              Editar despesa do cartão
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Cartão */}
            <div>
              <label className={labelCls}>Selecione o Cartão*</label>
              <select
                value={cartaoId}
                onChange={(e) => setCartaoId(e.target.value)}
                className={inputCls}
                required
              >
                <option value="">Selecione o Cartão*</option>
                {cartoes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Data de Referência */}
            <div>
              <label className={labelCls}>Data de Referência*</label>
              <input
                type="date"
                value={dataReferencia}
                onChange={(e) => setDataReferencia(e.target.value)}
                className={inputCls}
                required
              />
            </div>

            {/* Nome */}
            <div>
              <label className={labelCls}>Nome da saída*</label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome da saída*"
                className={inputCls}
                required
              />
            </div>

            {/* Valor */}
            <div>
              <label className={labelCls}>Valor*</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="Valor*"
                className={inputCls}
                required
              />
            </div>

            {/* Categoria */}
            <div>
              <label className={labelCls}>Selecione a Categoria*</label>
              <select
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
                className={inputCls}
                required
              >
                <option value="">Selecione a Categoria*</option>
                {categoriasDespesa.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Recorrente — exclusivo dos planos pagos (VIP/Premium) */}
            <div>
              <label className={labelCls}>Recorrente:</label>
              <div
                className={`flex items-center gap-6 pl-1 ${!canAccessRecurring ? 'opacity-50' : ''}`}
              >
                <label
                  className={`flex items-center gap-2 text-xs font-semibold text-gray-700 ${
                    canAccessRecurring ? 'cursor-pointer' : 'cursor-not-allowed'
                  }`}
                  title={!canAccessRecurring ? 'Recurso exclusivo do plano VIP' : undefined}
                >
                  <input
                    type="radio"
                    name="recorrente"
                    checked={recorrente === 'sim'}
                    onChange={() => canAccessRecurring && setRecorrente('sim')}
                    disabled={!canAccessRecurring}
                    className="accent-[#6639A6] w-4 h-4"
                  />
                  Sim
                </label>
                <label
                  className={`flex items-center gap-2 text-xs font-semibold text-gray-700 ${
                    canAccessRecurring ? 'cursor-pointer' : 'cursor-not-allowed'
                  }`}
                >
                  <input
                    type="radio"
                    name="recorrente"
                    checked={recorrente === 'nao'}
                    onChange={() => setRecorrente('nao')}
                    disabled={!canAccessRecurring}
                    className="accent-[#6639A6] w-4 h-4"
                  />
                  Não
                </label>
                {!canAccessRecurring && (
                  <Link
                    to="/planos"
                    className="ml-auto flex items-center gap-1 text-[10px] font-bold text-amber-500"
                  >
                    Recurso VIP
                  </Link>
                )}
              </div>
            </div>

            {/* Prévia da fatura — regra do vencimento aplicada */}
            {faturaPrevista && cartaoSelecionado && (
              <p className="text-[11px] text-gray-500 bg-[#F6F3FB] rounded-xl px-3 py-2">
                Este lançamento entra na{' '}
                <strong>fatura de {rotuloMesFatura(faturaPrevista)}</strong> (vencimento dia{' '}
                {cartaoSelecionado.dia_vencimento}).
              </p>
            )}

            {/* Ações */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex-1 py-3 text-xs font-bold text-[#6639A6] rounded-2xl bg-[#F1EAF9] hover:bg-[#E3D5F5] transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-3 text-xs font-bold text-white rounded-2xl bg-[#6639A6] hover:bg-[#522c8a] disabled:opacity-60 transition"
              >
                {saving ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </form>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}

/** Rótulo "junho/2026" a partir de um mês "2026-06". */
const rotuloMesFatura = (mesStr: string): string => {
  const [ano, mes] = mesStr.split('-').map(Number)
  return `${new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long' })}/${ano}`
}
