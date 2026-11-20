import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppHeader } from '@/components/AppHeader'
import { BottomNav } from '@/components/BottomNav'
import { cartoesService } from '@/services/cartoes'
import { categoriasService } from '@/services/categorias'
import { transacoesService } from '@/services/transacoes'
import type { Cartao, Categoria } from '@/types/financial'
import { toast } from '@/hooks/use-toast'
import { ArrowLeftRight, CreditCard, Wallet, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'

type Modo = 'saida' | 'entrada'
type AbaSaida = 'cartao' | 'outras'

/**
 * Cadastro de movimentação — espelho do modal do app original:
 * para SAÍDAS há as abas "Cartão" e "Outras"; para ENTRADAS um formulário
 * simples (sem cartão e sem parcelas). Parcelas dividem o valor em N
 * lançamentos mensais futuros no cartão.
 */
export const NewTransactionPage: React.FC = () => {
  const navigate = useNavigate()

  const [modo, setModo] = useState<Modo>('saida')
  const [aba, setAba] = useState<AbaSaida>('cartao')

  const [cartoes, setCartoes] = useState<Cartao[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])

  const [cartaoId, setCartaoId] = useState('')
  const [dataReferencia, setDataReferencia] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [nome, setNome] = useState('')
  const [valor, setValor] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [parcelas, setParcelas] = useState('1')
  const [recorrente, setRecorrente] = useState<'sim' | 'nao'>('nao')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const [cs, cats] = await Promise.all([cartoesService.list(), categoriasService.list()])
        setCartoes(cs)
        if (cs.length > 0) setCartaoId(cs[0].id)
        setCategorias(cats)
      } catch (err) {
        console.error(err)
        toast({ variant: 'destructive', title: 'Erro ao carregar dados do formulário' })
      }
    }
    load()
  }, [])

  const categoriasDoModo = useMemo(
    () =>
      categorias.filter((c) => (modo === 'entrada' ? c.tipo === 'receita' : c.tipo === 'despesa')),
    [categorias, modo],
  )

  const numParcelas = Math.max(1, Math.min(24, Number(parcelas) || 1))
  const valorNum = Number(valor.replace(',', '.'))

  const reset = () => {
    setNome('')
    setValor('')
    setCategoriaId('')
    setParcelas('1')
    setRecorrente('nao')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!nome.trim()) {
      toast({ variant: 'destructive', title: 'Informe o nome da movimentação' })
      return
    }
    if (!valorNum || valorNum <= 0) {
      toast({ variant: 'destructive', title: 'Informe um valor válido' })
      return
    }
    if (modo === 'saida' && aba === 'cartao' && !cartaoId) {
      toast({ variant: 'destructive', title: 'Selecione o cartão' })
      return
    }
    if (!categoriaId) {
      toast({ variant: 'destructive', title: 'Selecione a categoria' })
      return
    }

    setSaving(true)
    try {
      const isCartao = modo === 'saida' && aba === 'cartao'
      const parcelasNum = isCartao ? numParcelas : 1

      await transacoesService.createComParcelas({
        descricao: nome.trim(),
        valor: valorNum,
        tipo: modo === 'entrada' ? 'receita' : 'despesa',
        data: dataReferencia,
        categoriaId,
        cartaoId: isCartao ? cartaoId : undefined,
        parcelas: parcelasNum,
        recorrente: recorrente === 'sim',
      })

      toast({
        title:
          parcelasNum > 1 ? `${parcelasNum} parcelas cadastradas!` : 'Movimentação cadastrada!',
        description:
          parcelasNum > 1
            ? 'As parcelas aparecem nos meses seguintes conforme a fatura.'
            : 'O lançamento foi registrado com sucesso.',
      })
      reset()
      navigate('/')
    } catch (err) {
      console.error(err)
      toast({
        variant: 'destructive',
        title: 'Erro ao cadastrar',
        description: 'Verifique os campos e tente novamente.',
      })
    } finally {
      setSaving(false)
    }
  }

  const inputCls =
    'w-full h-11 px-3 rounded-xl border border-gray-200 text-sm text-[#1F1438] bg-white focus:outline-none focus:ring-2 focus:ring-[#6639A6]/30 focus:border-[#6639A6]'
  const labelCls = 'block text-[11px] font-semibold text-gray-600 mb-1'

  return (
    <div className="min-h-screen bg-[#F6F3FB] text-[#1F1438] pb-24">
      <AppHeader />

      <main className="max-w-md mx-auto px-4 pt-4 pb-10">
        <div className="bg-white rounded-3xl p-5 shadow-[0_4px_24px_rgba(102,57,166,0.08)] border border-[#EBE4F5]">
          {/* Seletor Entrada / Saída */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <button
              type="button"
              onClick={() => setModo('saida')}
              className={`flex-1 py-2.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                modo === 'saida'
                  ? 'bg-[#6639A6] text-white shadow-md'
                  : 'bg-[#F6F3FB] text-[#6639A6] hover:bg-[#EFE7F8]'
              }`}
            >
              <ArrowDownCircle className="w-4 h-4" />
              Saída
            </button>
            <button
              type="button"
              onClick={() => setModo('entrada')}
              className={`flex-1 py-2.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                modo === 'entrada'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-[#F6F3FB] text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              <ArrowUpCircle className="w-4 h-4" />
              Entrada
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Abas Cartão / Outras (somente saídas) */}
            {modo === 'saida' && (
              <div className="grid grid-cols-2 gap-1 bg-[#F1EAF9] rounded-2xl p-1">
                <button
                  type="button"
                  onClick={() => setAba('cartao')}
                  className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                    aba === 'cartao' ? 'bg-white text-[#6639A6] shadow-xs' : 'text-gray-500'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Cartão
                </button>
                <button
                  type="button"
                  onClick={() => setAba('outras')}
                  className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                    aba === 'outras' ? 'bg-white text-[#6639A6] shadow-xs' : 'text-gray-500'
                  }`}
                >
                  <Wallet className="w-3.5 h-3.5" />
                  Outras
                </button>
              </div>
            )}

            {/* Cartão (somente aba Cartão) */}
            {modo === 'saida' && aba === 'cartao' && (
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
            )}

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
              <label className={labelCls}>
                {modo === 'entrada' ? 'Nome da entrada*' : 'Nome da saída*'}
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder={modo === 'entrada' ? 'Nome da entrada*' : 'Nome da saída*'}
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
                {categoriasDoModo.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Parcelas (somente aba Cartão) */}
            {modo === 'saida' && aba === 'cartao' && (
              <div>
                <label className={labelCls}>Parcelas</label>
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={parcelas}
                  onChange={(e) => setParcelas(e.target.value)}
                  placeholder="Parcelas"
                  className={inputCls}
                />
                {numParcelas > 1 && valorNum > 0 && (
                  <p className="text-[10px] text-gray-500 mt-1">
                    {numParcelas}x de{' '}
                    <strong className="text-[#6639A6]">
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }).format(valorNum / numParcelas)}
                    </strong>{' '}
                    — um lançamento por mês, conforme a fatura.
                  </p>
                )}
              </div>
            )}

            {/* Recorrente */}
            <div>
              <label className={labelCls}>Recorrente:</label>
              <div className="flex items-center gap-6 pl-1">
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="recorrente"
                    checked={recorrente === 'sim'}
                    onChange={() => setRecorrente('sim')}
                    className="accent-[#6639A6] w-4 h-4"
                  />
                  Sim
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="recorrente"
                    checked={recorrente === 'nao'}
                    onChange={() => setRecorrente('nao')}
                    className="accent-[#6639A6] w-4 h-4"
                  />
                  Não
                </label>
              </div>
            </div>

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
                {saving ? 'Cadastrando...' : 'Cadastrar'}
              </button>
            </div>
          </form>
        </div>

        <p className="text-center text-[10px] text-gray-400 mt-3 flex items-center justify-center gap-1">
          <ArrowLeftRight className="w-3 h-3" />
          Gastos no cartão a partir do dia do vencimento caem na fatura do mês seguinte.
        </p>
      </main>

      <BottomNav />
    </div>
  )
}
